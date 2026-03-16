const Imap = require("node-imap");
const { simpleParser } = require("mailparser");
const nodemailer = require("nodemailer");
const db = require("./db");
const gemini = require("./gemini");
const storage = require("./storage");

/**
 * Servicio Worker de Email
 */
class EmailWorker {
    constructor() {
        this.config = {
            user: process.env.EMAIL_USER,
            password: process.env.EMAIL_PASS,
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            tls: true,
            authTimeout: 3000,
        };

        if (!this.config.user || !this.config.host) {
            console.warn("Falta la configuración de Email");
            return;
        }

        console.log(`[EMAIL] Configurado: ${this.config.host}:${this.config.port} (User: ${this.config.user})`);

        this.imap = new Imap(this.config);

        // Configurar transportador de correo para respuestas/alertas
        // Definir host y puerto SMTP (salida) de forma inteligente
        let smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
        let smtpPort = parseInt(process.env.SMTP_PORT || (smtpHost.includes("gmail.com") ? 465 : 587));

        // Corrección automática: si el host es de IMAP, cambiar a SMTP si es Gmail
        if (smtpHost === "imap.gmail.com") smtpHost = "smtp.gmail.com";
        if (smtpPort === 993) smtpPort = 465;

        console.log(`[EMAIL] Entrada (IMAP): ${this.config.host}:${this.config.port}`);
        console.log(`[EMAIL] Salida (SMTP): ${smtpHost}:${smtpPort}`);

        this.transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
            tls: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2'
            },
            debug: false,
            logger: false,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 30000
        });

        // Verificar conexión SMTP al inicio
        this.transporter.verify((error, success) => {
            if (error) {
                console.error("[EMAIL] Error de configuración SMTP:", error.message);
            } else {
                console.log("[EMAIL] Servidor de salida (SMTP) listo para enviar alertas.");
            }
        });
    }

    async sendAlert(to, subject, text) {
        try {
            await this.transporter.sendMail({
                from: `"Cajón de Facturas" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                text
            });
            console.log(`[EMAIL] Alerta enviada a ${to}: ${subject}`);
        } catch (error) {
            console.error("[EMAIL] Error enviando alerta:", error);
        }
    }

    // ... (start y poll se mantienen igual)
    start() {
        console.log("Iniciando Email Worker (monitorizando cada 5 minutos)...");
        this.poll();
        setInterval(() => this.poll(), 5 * 60 * 1000);
    }

    poll() {
        console.log(`[EMAIL] Iniciando búsqueda de correos...`);
        this.imap.once("ready", () => {
            console.log("[EMAIL] Conexión IMAP establecida.");
            this.imap.openBox("INBOX", false, (err, box) => {
                if (err) return this.handleError(err);

                this.imap.search(["UNSEEN"], (err, results) => {
                    if (err) {
                        console.error("[EMAIL] Error en búsqueda:", err);
                        return this.handleError(err);
                    }
                    console.log(`[EMAIL] Correos no leídos encontrados: ${results ? results.length : 0}`);
                    if (!results || results.length === 0) {
                        this.imap.end();
                        return;
                    }

                    const f = this.imap.fetch(results, { bodies: "", markSeen: true });
                    f.on("message", (msg) => {
                        msg.on("body", (stream) => {
                            simpleParser(stream, async (err, mail) => {
                                if (err) return console.error("Error al analizar el correo:", err);
                                await this.processMail(mail);
                            });
                        });
                    });

                    f.once("end", () => {
                        this.imap.end();
                    });
                });
            });
        });

        this.imap.once("error", (err) => this.handleError(err));
        this.imap.connect();
    }

    async processMail(mail) {
        console.log(`[EMAIL] Analizando correo de: ${mail.from.value[0].address}`);
        const fromAddress = mail.from.value[0].address.toLowerCase();
        const user = await db.findUserByEmail(fromAddress);

        if (!user) {
            console.log(`[EMAIL] Remitente no registrado: ${fromAddress}. Omitiendo.`);
            return;
        }

        const attachments = mail.attachments.filter(att =>
            att.contentType === "application/pdf" || att.contentType.startsWith("image/")
        );

        if (attachments.length === 0) {
            console.log(`[EMAIL] Correo de ${fromAddress} recibido pero sin adjuntos válidos (PDF/Imagen).`);
            return;
        }

        console.log(`Procesando ${attachments.length} adjuntos para el usuario ${user.email}...`);

        try {
            const filesData = attachments.map((att, index) => {
                return {
                    buffer: att.content,
                    originalName: att.filename || `email-adjunto-${index}`,
                    mimeType: att.contentType
                };
            });

            // Guardar agrupado
            const mainFilePath = await storage.saveInvoiceFiles(user.id, filesData);

            // Preparar para Gemini
            const geminiFiles = filesData.map(f => ({
                data: f.buffer.toString('base64'),
                mimeType: f.mimeType
            }));

            const result = await gemini.extractInvoiceData(geminiFiles, user.r_eq);

            // Validaciones de duplicados
            const duplicateRef = await db.checkDuplicateReference(user.id, result.referencia);
            const duplicateAmount = await db.checkDuplicateAmountDate(user.id, result.total, result.fecha_emision);

            let alertMessage = "";
            let emailSubject = "✅ Factura procesada correctamente";

            if (duplicateRef) {
                return await this.sendAlert(user.email, "⚠️ Factura Duplicada",
                    `Hola ${user.name},\n\nLa factura con referencia "${result.referencia}" ya existe en el sistema. NO se ha guardado de nuevo para evitar duplicidad.`);
            } else if (duplicateAmount) {
                alertMessage += `\n⚠️ AVISO: Se ha detectado otra factura con el mismo importe (${result.total}€) y fecha (${result.fecha_emision}). Revisa si es un duplicado.`;
                emailSubject = "⚠️ Aviso en factura procesada";
            }

            // Alarma R.EQ
            if (user.r_eq && (!result.r_eq || parseFloat(result.r_eq) <= 0)) {
                alertMessage += `\n⚠️ ¡ALARMA!: No se ha detectado Recargo de Equivalencia (R.EQ.) en esta factura.`;
                emailSubject = "🚨 Alarma en factura procesada";
            }

            // Guardar en DB
            await db.saveInvoice(user.id, result, 'email', result, mainFilePath);

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

            await this.sendAlert(user.email, emailSubject, feedback);

            console.log(`✅ Factura por Email de "${result.emisor}" procesada para ${user.email}`);

        } catch (error) {
            console.error(`Error procesando email para ${user.email}:`, error);
        }
    }

    handleError(err) {
        console.error("Error IMAP:", err);
        if (this.imap.state !== "disconnected") this.imap.end();
    }
}

module.exports = new EmailWorker();
