require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const morgan = require("morgan");
const db = require("./services/db");
const telegram = require("./services/telegram");
const emailWorker = require("./services/email_worker");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Servir archivos estáticos del Frontend (Productividad en Raspberry Pi)
app.use(express.static(path.join(__dirname, "../frontend/dist")));

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
            "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email",
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
        res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
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

app.delete("/api/invoices/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const deleted = await db.deleteInvoice(req.user.id, id);
        if (deleted) {
            res.json({ message: "Factura eliminada correctamente", id: deleted.id });
        } else {
            res.status(404).json({ error: "No se encontró la factura para eliminar" });
        }
    } catch (error) {
        console.error("Error eliminando factura:", error);
        res.status(500).json({ error: "Error interno del servidor" });
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
        delete user.password_hash; // Seguridad: no devolver el hash al cliente
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar Servicios
app.listen(PORT, '0.0.0.0', () => {
    console.log("¡Flujo de despliegue funcionando!")
    console.log(`Servidor ejecutándose en el puerto ${PORT}`);

    // Iniciar Bots y Workers
    if (process.env.TELEGRAM_BOT_TOKEN) {
        telegram.launch();
    }

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        emailWorker.start();
    }
});

/**
 * SPA Routing: Redirigir todas las rutas no-API al index.html del frontend
 */
app.get(/.*/, (req, res) => {
    if (!req.url.startsWith("/api")) {
        res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
    }
});
