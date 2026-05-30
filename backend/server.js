require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const db = require("./services/db");
const telegramService = require("./services/telegram"); // Renamed from 'telegram'
const emailWorker = require("./services/email_worker");
const storage = require("./services/storage"); // Added
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const gemini = require("./services/gemini");

// Configuración de Multer para almacenamiento en disco con aislamiento por usuario
const fs = require("fs");
const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.user.id;
        const uploadPath = path.join(__dirname, "uploads", userId.toString());
        
        // Crear carpeta del usuario si no existe
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + "-" + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: multerStorage });

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Middleware de log personalizado para ver todas las peticiones
app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
});

// Servir archivos estáticos del Frontend (Productividad en Raspberry Pi)
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Servir archivos de facturas subidas
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

/**
 * Middleware de Autenticación JWT - SOLO PARA RUTAS /api
 */
app.use("/api", async (req, res, next) => {
    // Permitir rutas de login/registro sin token
    if (req.url.startsWith("/auth")) {
        return next();
    }

    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ error: "No se proporcionó token" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error("[ERROR] JWT inválido:", error);
        res.status(403).json({ error: "Token inválido" });
    }
});

// Rutas de Autenticación
app.post("/api/auth/register", async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const { rows } = await db.query(
            "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, lastname, company, sector, phone, email, r_eq",
            [name, email, hashedPassword]
        );
        const user = rows[0];
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        res.json({ token, user });
    } catch (error) {
        console.error("[ERROR] Registration failed:", error);
        if (error.code === '23505') { // Unique violation
            return res.status(400).json({ error: "El email ya está registrado" });
        }
        res.status(500).json({ error: "Error interno en el servidor al registrar" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        const user = rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }
        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET);
        // Devolver usuario completo sin el hash
        const userClean = { ...user };
        delete userClean.password_hash;
        res.json({ token, user: userClean });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Rutas API
app.get("/api/invoices", async (req, res) => {
    try {
        const { rows } = await db.query(
            "SELECT * FROM invoices WHERE user_id = $1 ORDER BY invoice_date DESC, created_at DESC",
            [req.user.id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/stock-summary", async (req, res) => {
    try {
        const stockSummaryPath = "/home/charly/facturas/backend/stock_summary.json";
        const downloadsDir = "/home/charly/Descargas";
        const fileRegex = /^Listado de productos activos \d{8}-\d{4}\.csv$/;

        if (!fs.existsSync(downloadsDir)) {
            return res.json({ total_stock_value: 0, total_units: 0, product_count: 0, file: null });
        }

        const files = fs.readdirSync(downloadsDir, { withFileTypes: true })
            .filter((entry) => entry.isFile() && fileRegex.test(entry.name))
            .map((entry) => {
                const filePath = path.join(downloadsDir, entry.name);
                return { name: entry.name, path: filePath, mtimeMs: fs.statSync(filePath).mtimeMs };
            })
            .sort((a, b) => b.mtimeMs - a.mtimeMs);

        if (files.length === 0) {
            return res.json({ total_stock_value: 0, total_units: 0, product_count: 0, file: null });
        }

        const latest = files[0];

        if (fs.existsSync(stockSummaryPath)) {
            try {
                const summary = JSON.parse(fs.readFileSync(stockSummaryPath, "utf8"));
                if (summary.file === latest.name && summary.source === "strator_official_value") {
                    return res.json(summary);
                }
            } catch (summaryError) {
                console.error("Error leyendo resumen oficial de stock:", summaryError);
            }
        }

        const content = fs.readFileSync(latest.path, "latin1");
        const lines = content.split(/\r?\n/).filter(Boolean);

        const parseCsvLine = (line) => {
            const cells = [];
            let current = "";
            let inQuotes = false;

            for (let i = 0; i < line.length; i += 1) {
                const char = line[i];
                const next = line[i + 1];

                if (char === '"' && inQuotes && next === '"') {
                    current += '"';
                    i += 1;
                } else if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ';' && !inQuotes) {
                    cells.push(current);
                    current = "";
                } else {
                    current += char;
                }
            }

            cells.push(current);
            return cells;
        };

        const parseNumber = (value) => Number(String(value || "")
            .replace(/[^0-9,.-]/g, "")
            .replace(/\./g, "")
            .replace(",", ".")) || 0;

        const headers = parseCsvLine(lines[0]);
        const priceIndex = headers.indexOf("Precio de venta");
        const stockIndex = headers.indexOf("Stock");

        if (priceIndex === -1 || stockIndex === -1) {
            return res.status(500).json({ error: "El CSV de stock no tiene las columnas esperadas" });
        }

        let totalStockValue = 0;
        let totalUnits = 0;
        let productCount = 0;

        for (const line of lines.slice(1)) {
            const cells = parseCsvLine(line);
            const price = parseNumber(cells[priceIndex]);
            const stock = parseNumber(cells[stockIndex]);

            totalStockValue += price * stock;
            totalUnits += stock;
            productCount += 1;
        }

        res.json({
            total_stock_value: Number(totalStockValue.toFixed(2)),
            total_units: totalUnits,
            product_count: productCount,
            file: latest.name
        });
    } catch (error) {
        console.error("Error leyendo stock:", error);
        res.status(500).json({ error: "Error al leer el stock" });
    }
});

app.get("/api/cash-history", async (req, res) => {
    try {
        const baseDir = "/home/charly/estanco/z_cajas";
        const dailyFileRegex = /^z_cajas_(\d{4})_(\d{2})_(\d{2})\.json$/;

        if (!fs.existsSync(baseDir)) {
            return res.json([]);
        }

        const yearDirs = fs.readdirSync(baseDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => path.join(baseDir, entry.name));

        const records = [];

        for (const yearDir of yearDirs) {
            const files = fs.readdirSync(yearDir, { withFileTypes: true })
                .filter((entry) => entry.isFile() && dailyFileRegex.test(entry.name));

            for (const file of files) {
                const match = file.name.match(dailyFileRegex);
                const filePath = path.join(yearDir, file.name);
                const raw = fs.readFileSync(filePath, "utf8");
                const json = JSON.parse(raw);
                const fecha = json.fecha_z || `${match[1]}-${match[2]}-${match[3]}`;
                const importeVentas = json.resumen_contable?.["Importe ventas IVA incl."] || {};
                const totalIva = json.analisis_iva_totales || {};

                records.push({
                    id: `${match[1]}-${match[2]}-${match[3]}`,
                    fecha,
                    importe_ventas_iva_incl: importeVentas.importe || null,
                    importe_ventas_iva_incl_num: Number(importeVentas.importe_num || 0),
                    iva_repercutido: totalIva.total_iva || null,
                    iva_repercutido_num: Number(totalIva.total_iva_num || 0),
                    archivo: file.name
                });
            }
        }

        records.sort((a, b) => b.fecha.localeCompare(a.fecha));
        res.json(records);
    } catch (error) {
        console.error("Error leyendo historial de cajas:", error);
        res.status(500).json({ error: "Error al leer el historial de cajas" });
    }
});

app.get("/api/invoices/download/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const invoice = await db.getInvoiceById(req.user.id, id);

        if (!invoice || !invoice.file_path) {
            return res.status(404).json({ error: "Archivo no encontrado" });
        }

        const fullPath = path.join(__dirname, invoice.file_path);
        
        if (!fs.existsSync(fullPath)) {
            console.error("[STORAGE] El archivo no existe en el disco:", fullPath);
            return res.status(404).json({ error: "El archivo físico no existe en el servidor" });
        }

        // Forzar descarga con el nombre adecuado y la extensión original (que ahora será .pdf casi siempre)
        const fileExt = path.extname(invoice.file_path) || '.pdf';
        res.download(fullPath, `${invoice.emisor}-${invoice.reference || invoice.id}${fileExt}`);
    } catch (error) {
        console.error("Error al descargar factura:", error);
        res.status(500).json({ error: "Error al procesar la descarga" });
    }
});

app.delete("/api/invoices/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const deleted = await db.deleteInvoice(req.user.id, id);
        if (deleted) {
            // Borrar archivo físico si existe usando la utilidad centralizada
            if (deleted.file_path) {
                storage.deleteFile(deleted.file_path);
            }
            res.json({ message: "Factura eliminada correctamente", id: deleted.id });
        } else {
            res.status(404).json({ error: "No se encontró la factura para eliminar" });
        }
    } catch (error) {
        console.error("Error eliminando factura:", error);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

app.post("/api/invoices/upload", upload.single("invoice"), async (req, res) => {
    try {
        console.log("[UPLOAD] Iniciando subida manual para usuario:", req.user.id);
        if (!req.file) {
            console.log("[UPLOAD] Error: No se recibió archivo");
            return res.status(400).json({ error: "No se subió ningún archivo" });
        }

        console.log("[UPLOAD] Archivo recibido y guardado en:", req.file.path);

        const userFetch = await db.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
        const userData = userFetch.rows[0];

        if (!userData) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Para Gemini necesitamos leer el archivo
        const fileBase64 = fs.readFileSync(req.file.path).toString("base64");

        const fileData = [{
            data: fileBase64,
            mimeType: req.file.mimetype
        }];

        console.log("[UPLOAD] Enviando a Gemini AI...");
        let result = await gemini.extractInvoiceData(fileData, userData.r_eq);
        result = db.prepareInvoiceData(result, result);
        console.log("[UPLOAD] Resultado IA recibido:", result.emisor, result.total);

        // Validaciones de duplicados después de aplicar reglas de normalización.
        const duplicateInvoice = await db.checkDuplicateInvoice(userData.id, result, result);
        if (duplicateInvoice.invoice) {
            const duplicateRefText = duplicateInvoice.invoice.reference || result.referencia;
            return res.json({ 
                warning: true, 
                message: `La factura "${duplicateRefText}" ya existe en tu historial. No se ha guardado de nuevo para evitar duplicidad.`,
                invoice: result
            });
        }

        const duplicateAmount = await db.checkDuplicateAmountDate(userData.id, result.total, result.fecha_emision);
        let warningMessage = "";
        if (duplicateAmount) {
            warningMessage = "Aviso: Se ha detectado otra factura con el mismo importe y fecha. ";
        }

        // Alarma de Recargo de Equivalencia (R.EQ)
        if (userData.r_eq && (!result.r_eq || parseFloat(result.r_eq) <= 0)) {
            warningMessage += "¡Atención!: No se ha detectado Recargo de Equivalencia (R.EQ.) en esta factura. ";
        }

        // Procesar y guardar el archivo final (convirtiendo a PDF si es imagen)
        const fileBuffer = fs.readFileSync(req.file.path);
        const relativePath = await storage.saveInvoiceFiles(userData.id, [{
            buffer: fileBuffer,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype
        }]);

        // Borrar el archivo temporal de multer
        fs.unlinkSync(req.file.path);

        const saved = await db.saveInvoice(userData.id, result, 'web', result, relativePath);

        res.json({
            message: warningMessage || "Factura procesada y guardada correctamente.",
            warning: !!warningMessage,
            invoice: saved
        });

    } catch (error) {
        console.error("[UPLOAD] Error crítico:", error);
        res.status(500).json({ error: "Error al procesar la factura con IA: " + error.message });
    }
});

app.get("/api/stats", async (req, res) => {
    try {
        const userId = req.user.id;

        // Acumulado Total (la lógica por trimestre se puede refinar)
        const statsQuery = `
      SELECT 
        SUM(total) as total_accumulated,
        SUM(iva) as total_iva,
        COUNT(*) as invoice_count
      FROM invoices 
      WHERE user_id = $1
    `;
        const stats = await db.query(statsQuery, [userId]);

        // Principales Emisores
        const emisorQuery = `
      SELECT emisor, COUNT(*) as count, SUM(total) as total
      FROM invoices
      WHERE user_id = $1
      GROUP BY emisor
      ORDER BY total DESC
      LIMIT 5
    `;
        const topEmisors = await db.query(emisorQuery, [userId]);

        res.json({
            summary: stats.rows[0],
            topEmisors: topEmisors.rows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Actividades
app.get("/api/activities", async (req, res) => {
    try {
        const activities = await db.getActivitiesByUserId(req.user.id);
        res.json(activities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/activities", async (req, res) => {
    try {
        const activity = await db.createActivity(req.user.id);
        res.json(activity);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put("/api/activities/:id", async (req, res) => {
    const { name, description } = req.body;
    try {
        const updated = await db.updateActivity(req.user.id, req.params.id, name, description);
        if (!updated) return res.status(404).json({ error: "Actividad no encontrada" });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Emisores y mapeo
app.get("/api/issuers", async (req, res) => {
    try {
        const issuers = await db.getUserIssuers(req.user.id);
        res.json(issuers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/issuers/link", async (req, res) => {
    const { emisor_name, activity_id, invoice_type } = req.body;
    try {
        const result = await db.linkIssuerToActivity(req.user.id, emisor_name, activity_id, invoice_type);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put("/api/invoices/:id/other-expense", async (req, res) => {
    const { value } = req.body;
    try {
        const updated = await db.updateInvoiceOtherExpense(req.user.id, req.params.id, value);
        if (!updated) return res.status(404).json({ error: "Factura no encontrada" });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
app.put("/api/invoices/:id/activity", async (req, res) => {
    try {
        const { id } = req.params;
        const { activityName } = req.body;
        const userId = req.user.id;

        const updated = await db.updateInvoiceActivity(userId, id, activityName);
        if (!updated) {
            return res.status(404).json({ error: "Factura no encontrada" });
        }
        res.json(updated);
    } catch (error) {
        console.error("Error updating invoice activity:", error);
        res.status(500).json({ error: error.message });
    }
});

app.put("/api/invoices/:id/type", async (req, res) => {
    try {
        const { id } = req.params;
        const { invoiceType } = req.body;
        const updated = await db.updateInvoiceType(req.user.id, id, invoiceType);
        if (!updated) return res.status(404).json({ error: "Factura no encontrada" });
        res.json(updated);
    } catch (error) {
        console.error("Error updating invoice type:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/profile", async (req, res) => {
    try {
        const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put("/api/profile", async (req, res) => {
    const { name, lastname, company, sector, phone, email, r_eq, password } = req.body;
    try {
        let query;
        let params;

        if (password && password.trim() !== "") {
            const hashedPassword = await bcrypt.hash(password, 10);
            query = `UPDATE users 
                     SET name = $1, lastname = $2, company = $3, sector = $4, phone = $5, email = $6, r_eq = $7, password_hash = $8
                     WHERE id = $9 RETURNING *`;
            params = [name, lastname, company, sector, phone, email, r_eq, hashedPassword, req.user.id];
        } else {
            query = `UPDATE users 
                     SET name = $1, lastname = $2, company = $3, sector = $4, phone = $5, email = $6, r_eq = $7
                     WHERE id = $8 RETURNING *`;
            params = [name, lastname, company, sector, phone, email, r_eq, req.user.id];
        }

        const { rows } = await db.query(query, params);
        const user = rows[0];
        if (user) {
            delete user.password_hash;
        }
        res.json(user);
    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({ error: error.message });
    }
});

// Iniciar Servicios
app.listen(PORT, '0.0.0.0', () => {
    console.log("¡Flujo de despliegue funcionando!")
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);

    // Iniciar Bots y Workers
    if (process.env.TELEGRAM_BOT_TOKEN) {
        telegramService.launch();
    }

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        emailWorker.start();
    }
});

// SPA Routing: Redirigir todas las rutas no-API y no-uploads al index.html del frontend
app.get(/.*/, (req, res) => {
    if (!req.url.startsWith("/api") && !req.url.startsWith("/uploads")) {
        res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
    } else {
        res.status(404).json({ error: "Ruta no encontrada" });
    }
});

// Manejador de errores global para que siempre devuelvan JSON en /api
app.use((err, req, res, next) => {
    console.error("[GLOBAL ERROR]", err);
    if (req.url.startsWith("/api")) {
        return res.status(err.status || 500).json({ 
            error: "Error interno en el servidor", 
            message: err.message 
        });
    }
    next(err);
});
