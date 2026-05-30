-- Database Schema for Cajón de Facturas

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    lastname TEXT,
    company TEXT,
    sector TEXT,
    phone TEXT, -- To match Telegram (if provided)
    telegram_id TEXT UNIQUE, -- Primary match for Telegram bot
    email TEXT UNIQUE NOT NULL, -- To match Email sender
    password_hash TEXT,
    r_eq BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emisor TEXT,
    invoice_date DATE,
    reference TEXT,
    subtotal DECIMAL(12, 2),
    iva DECIMAL(12, 2),
    r_eq DECIMAL(12, 2),
    total_taxes DECIMAL(12, 2),
    total DECIMAL(12, 2),
    ingestion_channel TEXT CHECK (ingestion_channel IN ('telegram', 'email', 'web')),
    invoice_type TEXT NOT NULL DEFAULT 'expense' CHECK (invoice_type IN ('expense', 'income', 'other_expense', 'labor_expense', 'other_income')),
    raw_ai_response JSONB,
    file_path TEXT, -- Optional: path to stored PDF/Image
    actividad TEXT,
    is_other_expense BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for duplicate detection
CREATE INDEX IF NOT EXISTS idx_invoice_reference_user ON invoices(reference, user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_amount_date_user ON invoices(total, invoice_date, user_id);


CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_issuers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emisor_name TEXT NOT NULL,
    activity_id INTEGER REFERENCES activities(id) ON DELETE SET NULL,
    invoice_type TEXT NOT NULL DEFAULT 'expense' CHECK (invoice_type IN ('expense', 'income', 'other_expense', 'labor_expense', 'other_income')),
    UNIQUE(user_id, emisor_name)
);
