const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const db = require("./services/db");

async function migrate() {
    try {
        console.log("Running database migrations...");

        await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;");
        await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS actividad TEXT;");
        await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS is_other_expense BOOLEAN DEFAULT FALSE;");
        await db.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'expense';");
        await db.query("ALTER TABLE user_issuers ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'expense';");

        await db.query("UPDATE invoices SET invoice_type = 'expense' WHERE invoice_type IS NULL;");
        await db.query("UPDATE user_issuers SET invoice_type = 'expense' WHERE invoice_type IS NULL;");

        await db.query("ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;");
        await db.query("ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check CHECK (invoice_type IN ('expense','income','other_expense','labor_expense','other_income'));");
        await db.query("ALTER TABLE user_issuers DROP CONSTRAINT IF EXISTS user_issuers_invoice_type_check;");
        await db.query("ALTER TABLE user_issuers ADD CONSTRAINT user_issuers_invoice_type_check CHECK (invoice_type IN ('expense','income','other_expense','labor_expense','other_income'));");

        console.log("Migration successful!");
        process.exit(0);
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    }
}

migrate();
