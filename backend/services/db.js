const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

/**
 * Manejo de consultas a la base de datos
 */
const query = (text, params) => pool.query(text, params);

/**
 * Buscar usuario por ID de Telegram
 */
const findUserByTelegramId = async (telegramId) => {
    const res = await query("SELECT * FROM users WHERE telegram_id = $1", [telegramId.toString()]);
    return res.rows[0];
};

/**
 * Buscar usuario por número de teléfono (desde contacto de Telegram)
 */
const findUserByPhone = async (phone) => {
    // Normalizar entrada: solo dígitos y sin ceros a la izquierda (0034 -> 34)
    const cleanInput = phone.replace(/\D/g, "").replace(/^0+/, "");
    if (!cleanInput) return null;

    // Buscar si el teléfono guardado coincide con la entrada (posiblemente con o sin prefijos)
    const res = await query(
        `SELECT * FROM users 
         WHERE STRPOS(regexp_replace(phone, '\\D', '', 'g'), $1) > 0 
            OR STRPOS($1, regexp_replace(regexp_replace(phone, '\\D', '', 'g'), '^0+', '')) > 0`,
        [cleanInput]
    );
    return res.rows[0];
};

/**
 * Buscar usuario por Email
 */
const findUserByEmail = async (email) => {
    const res = await query("SELECT * FROM users WHERE email = $1", [email.toLowerCase()]);
    return res.rows[0];
};

/**
 * Guardar factura extraída
 */
const saveInvoice = async (userId, data, channel, rawResponse) => {
    const {
        emisor,
        fecha_emision,
        referencia,
        subtotal,
        iva,
        r_eq,
        total_impuestos,
        total
    } = data;

    const text = `
    INSERT INTO invoices (
      user_id, emisor, invoice_date, reference, subtotal, iva, r_eq, total_taxes, total, ingestion_channel, raw_ai_response
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;
  `;
    const values = [
        userId, emisor, fecha_emision, referencia, subtotal, iva, r_eq, total_impuestos, total, channel, rawResponse
    ];

    const res = await query(text, values);
    return res.rows[0];
};

/**
 * Verificar duplicado por referencia
 */
const checkDuplicateReference = async (userId, reference) => {
    if (!reference) return null;
    const res = await query(
        "SELECT * FROM invoices WHERE user_id = $1 AND reference = $2",
        [userId, reference]
    );
    return res.rows[0];
};

/**
 * Verificar duplicado por importe y fecha
 */
const checkDuplicateAmountDate = async (userId, total, date) => {
    const res = await query(
        "SELECT * FROM invoices WHERE user_id = $1 AND total = $2 AND invoice_date = $3",
        [userId, total, date]
    );
    return res.rows[0];
};

/**
 * Borrar factura
 */
const deleteInvoice = async (userId, invoiceId) => {
    const res = await query(
        "DELETE FROM invoices WHERE id = $1 AND user_id = $2 RETURNING *",
        [invoiceId, userId]
    );
    return res.rows[0];
};

/**
 * Actualizar el telegram_id del usuario
 */
const updateUserTelegramId = async (userId, telegramId) => {
    await query("UPDATE users SET telegram_id = $1 WHERE id = $2", [telegramId.toString(), userId]);
};

module.exports = {
    query,
    findUserByTelegramId,
    findUserByPhone,
    findUserByEmail,
    saveInvoice,
    checkDuplicateReference,
    checkDuplicateAmountDate,
    deleteInvoice,
    updateUserTelegramId
};
