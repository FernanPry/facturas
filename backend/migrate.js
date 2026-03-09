require("dotenv").config();
const db = require("./services/db");

async function migrate() {
    try {
        console.log("Adding password_hash column to users table...");
        await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;");
        console.log("Migration successful!");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();
