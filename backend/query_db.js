require("dotenv").config();
const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function query() {
    try {
        const res = await pool.query("SELECT id, user_id, emisor, reference, total, ingestion_channel, created_at FROM invoices ORDER BY created_at DESC LIMIT 10;");
        console.log(JSON.stringify(res.rows, null, 2));
        const users = await pool.query("SELECT id, email, name FROM users;");
        console.log("Users:", JSON.stringify(users.rows, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await pool.end();
    }
}
query();
