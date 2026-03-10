const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");
const db = require("./db");
const gemini = require("./gemini");

/**
 * Servicio del Bot de Telegram
 */
class TelegramService {
    constructor() {
        if (!process.env.TELEGRAM_BOT_TOKEN) {
            console.warn("TELEGRAM_BOT_TOKEN no encontrado");
            return;
        }
        this.bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
        this.sessions = new Map(); // Almacén de sesiones en memoria (UserId -> { images: [] })

        this.setupHandlers();
    }

    setupHandlers() {
        // Middleware de depuración global
        this.bot.use((ctx, next) => {
            console.log(`[BOT] Actualización recibida tipo: ${ctx.updateType}`);
            if (ctx.message) {
                const keys = Object.keys(ctx.message).join(", ");
                console.log(`[BOT] Mensaje de ${ctx.from.username || ctx.from.first_name} (ID: ${ctx.from.id}). Campos: ${keys}`);
            }
            return next();
        });

        this.bot.start((ctx) => {
            console.log(`[BOT] Comando /start de ${ctx.from.id}`);
            return this.handleStart(ctx);
        });
        this.bot.on("contact", (ctx) => {
            console.log(`[BOT] Evento Contacto de ${ctx.from.id}`);
            return this.handleContact(ctx);
        });
        this.bot.on("photo", (ctx) => this.handlePhoto(ctx));
        this.bot.on("document", (ctx) => this.handleDocument(ctx));
        this.bot.action("process_images", (ctx) => this.handleProcessImages(ctx));
        this.bot.action("cancel_session", (ctx) => this.handleCancelSession(ctx));

        // Comandos de Ayuda / Cancelar
        this.bot.command("cancelar", (ctx) => this.handleCancelSession(ctx));
    }

    async handleStart(ctx) {
        const telegramId = ctx.from.id.toString();
        const user = await db.findUserByTelegramId(telegramId);

        if (user) {
            return ctx.reply(`¡Hola ${user.name}! Soy tu Cajón de Facturas. Puedes enviarme PDFs o fotos de tus facturas.`);
        } else {
            return ctx.reply(
                "¡Hola! No reconozco este Telegram. Por favor, pulsa el botón de abajo para vincular tu cuenta usando tu número de teléfono.",
                Markup.keyboard([Markup.button.contactRequest("Compartir Contacto")]).oneTime().resize()
            );
        }
    }

    async handleContact(ctx) {
        const contact = ctx.message.contact;
        const phone = contact.phone_number;
        const telegramId = ctx.from.id.toString();

        console.log(`[DEBUG] Recibido contacto: ${phone} (Telegram ID: ${telegramId})`);

        const user = await db.findUserByPhone(phone);
        if (user) {
            await db.updateUserTelegramId(user.id, telegramId);
            return ctx.reply(
                `¡Perfecto ${user.name}! Tu cuenta ha sido vinculada con éxito. Ya puedes enviarme facturas.`,
                Markup.removeKeyboard()
            );
        } else {
            console.log(`[DEBUG] No se encontró usuario para el teléfono: ${phone}`);
            return ctx.reply(
                "Lo siento, no he encontrado ninguna cuenta asociada a este teléfono en nuestra base de datos. Asegúrate de que el número en tu Perfil sea correcto.",
                Markup.removeKeyboard()
            );
        }
    }

    async handlePhoto(ctx) {
        const telegramId = ctx.from.id.toString();
        const user = await db.findUserByTelegramId(telegramId);

        if (!user) {
            return ctx.reply(
                "Primero debes vincular tu cuenta compartiendo tu contacto.",
                Markup.keyboard([Markup.button.contactRequest("Compartir Contacto")]).oneTime().resize()
            );
        }

        const photo = ctx.message.photo.pop(); // Obtener la versión más grande
        const fileUrl = await this.bot.telegram.getFileLink(photo.file_id);

        if (!this.sessions.has(telegramId)) {
            this.sessions.set(telegramId, { images: [] });
        }

        const session = this.sessions.get(telegramId);
        session.images.push(fileUrl.href);

        return ctx.reply(
            "¿La factura contiene más fotos?",
            Markup.inlineKeyboard([
                [Markup.button.callback("Sí, enviar más", "ignore")],
                [Markup.button.callback("No, procesar ahora", "process_images")],
                [Markup.button.callback("Cancelar", "cancel_session")]
            ])
        );
    }

    async handleDocument(ctx) {
        const telegramId = ctx.from.id.toString();
        const user = await db.findUserByTelegramId(telegramId);

        if (!user) {
            return ctx.reply(
                "Primero debes vincular tu cuenta compartiendo tu contacto.",
                Markup.keyboard([Markup.button.contactRequest("Compartir Contacto")]).oneTime().resize()
            );
        }

        const doc = ctx.message.document;
        if (doc.mime_type !== "application/pdf") {
            return ctx.reply("Por ahora solo acepto archivos PDF o imágenes directas.");
        }

        const fileUrl = await this.bot.telegram.getFileLink(doc.file_id);
        await ctx.reply("Procesando PDF por Cajón IA...");

        return this.processFiles(ctx, user, [fileUrl.href], "application/pdf");
    }

    async handleProcessImages(ctx) {
        const telegramId = ctx.from.id.toString();
        const user = await db.findUserByTelegramId(telegramId);
        const session = this.sessions.get(telegramId);

        if (!session || session.images.length === 0) {
            return ctx.answerCbQuery("No hay imágenes para procesar.");
        }

        await ctx.answerCbQuery();
        await ctx.editMessageText("Agrupando imágenes y enviando a Gemini...");

        const urls = session.images;
        this.sessions.delete(telegramId); // Limpiar sesión

        return this.processFiles(ctx, user, urls, "image/jpeg");
    }

    async handleCancelSession(ctx) {
        const telegramId = ctx.from.id.toString();
        this.sessions.delete(telegramId);
        if (ctx.callbackQuery) {
            await ctx.answerCbQuery("Flujo cancelado.");
            await ctx.editMessageText("Operación cancelada.");
        } else {
            await ctx.reply("Operación cancelada.");
        }
    }

    async processFiles(ctx, user, urls, mimeType) {
        try {
            // Descargar archivos y convertir a base64
            const filesData = await Promise.all(urls.map(async (url) => {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                return {
                    data: Buffer.from(response.data).toString('base64'),
                    mimeType: mimeType
                };
            }));

            const result = await gemini.extractInvoiceData(filesData, user.r_eq);

            // Validaciones de duplicados
            const duplicateRef = await db.checkDuplicateReference(user.id, result.referencia);
            const duplicateAmount = await db.checkDuplicateAmountDate(user.id, result.total, result.fecha_emision);

            let alertMessage = "";
            if (duplicateRef) {
                return await ctx.reply(`⚠️ ¡ALARMA!: La factura con referencia "${result.referencia}" ya existe. NO se ha vuelto a guardar.`);
            } else if (duplicateAmount) {
                alertMessage += `\n⚠️ AVISO: Se ha detectado otra factura con el mismo importe (${result.total}€) y fecha (${result.fecha_emision}). Revisa si es un duplicado.`;
            }

            // Alarma de Recargo de Equivalencia (R.EQ)
            if (user.r_eq && (!result.r_eq || parseFloat(result.r_eq) <= 0)) {
                alertMessage += `\n⚠️ ¡ALARMA!: No se ha detectado Recargo de Equivalencia (R.EQ.) en esta factura.`;
            }

            // Guardar en DB
            await db.saveInvoice(user.id, result, 'telegram', result);

            // Construir mensaje de éxito formateado
            const feedback = `✅ Datos extraídos y guardados:\n\n` +
                `📅 Fecha: ${result.fecha_emision}\n` +
                `👤 Emisor: ${result.emisor}\n` +
                `🔢 Factura: ${result.referencia}\n` +
                `💰 Subtotal: ${result.subtotal}\n` +
                `📑 IVA: ${result.iva}\n` +
                `♻️ Recargo Eq: ${result.r_eq || 0.0}\n` +
                `🧾 Total Impuestos: ${result.total_impuestos}\n` +
                `💵 TOTAL: ${result.total}\n` +
                `${alertMessage}`;

            await ctx.reply(feedback);
        } catch (error) {
            console.error("Error procesando factura de telegram:", error);
            await ctx.reply("Hubo un error procesando tu factura. Por favor, inténtalo de nuevo más tarde.");
        }
    }

    launch() {
        this.bot.launch().then(() => {
            console.log("✅ Bot de Telegram lanzado y conectado con éxito");
            this.bot.telegram.getMe().then(me => {
                console.log(`[BOT] Identificado como: @${me.username}`);
            });
        }).catch(err => {
            console.error("❌ Error al lanzar el bot de Telegram:", err);
        });
    }
}

module.exports = new TelegramService();
