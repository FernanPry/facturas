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
 * Calcular distancia de Levenshtein entre dos cadenas
 */
const getLevenshteinDistance = (s, t) => {
    if (!s || !t) return Math.max(s?.length || 0, t?.length || 0);
    const m = s.length;
    const n = t.length;
    let d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) d[i][0] = i;
    for (let j = 0; j <= n; j++) d[0][j] = j;

    for (let j = 1; j <= n; j++) {
        for (let i = 1; i <= m; i++) {
            const cost = s[i - 1] === t[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1,      // Deletion
                d[i][j - 1] + 1,      // Insertion
                d[i - 1][j - 1] + cost // Substitution
            );
        }
    }
    return d[m][n];
};

/**
 * Obtener el nombre canónico de un emisor basado en similitud (Fuzzy Matching)
 * Umbral: 2 caracteres de diferencia
 */
const getCanonicalEmisor = async (userId, newName) => {
    if (!newName) return newName;
    
    // Obtener todos los emisores únicos del usuario
    const res = await query(
        "SELECT DISTINCT emisor FROM invoices WHERE user_id = $1 AND emisor IS NOT NULL",
        [userId]
    );
    
    const existingIssuers = res.rows.map(r => r.emisor);
    let bestMatch = newName;
    let minDistance = 3; // Buscamos distancia <= 2

    for (const existing of existingIssuers) {
        const distance = getLevenshteinDistance(newName.toLowerCase().trim(), existing.toLowerCase().trim());
        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = existing;
        }
        if (minDistance === 0) break; // Coincidencia exacta
    }

    return bestMatch;
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
const saveInvoice = async (userId, data, channel, rawResponse, filePath = null) => {
    let {
        emisor,
        fecha_emision,
        referencia,
        subtotal,
        iva,
        r_eq,
        total_impuestos,
        total
    } = data;

    // Normalización: Agrupación difusa (Fuzzy Matching)
    emisor = await getCanonicalEmisor(userId, emisor);

    // Buscar si el emisor tiene una actividad pre-asignada
    const mappingRes = await query(
        `SELECT a.name 
         FROM user_issuers ui
         JOIN activities a ON a.id = ui.activity_id
         WHERE ui.user_id = $1 AND ui.emisor_name = $2`,
        [userId, emisor]
    );
    
    let activityName = mappingRes.rows.length > 0 ? mappingRes.rows[0].name : null;
    
    // Regla especial Logista: Si tiene productos específicos, forzar Actividad 3
    if (emisor.toLowerCase().includes("logista") && data.especial_logista) {
        activityName = "Actividad 3";
    }

    const text = `
    INSERT INTO invoices (
      user_id, emisor, invoice_date, reference, subtotal, iva, r_eq, total_taxes, total, ingestion_channel, raw_ai_response, file_path, actividad
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *;
  `;
    const values = [
        userId, emisor, fecha_emision, referencia, subtotal, iva, r_eq, total_impuestos, total, channel, rawResponse, filePath, activityName
    ];

    console.log("[DB] Guardando factura - Canal:", channel, "Ref:", referencia, "Actividad:", activityName);
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

/**
 * Obtener una factura por ID
 */
const getInvoiceById = async (userId, invoiceId) => {
    const res = await query(
        "SELECT * FROM invoices WHERE id = $1 AND user_id = $2",
        [invoiceId, userId]
    );
    return res.rows[0];
};

/**
 * Obtener actividades de un usuario
 */
const getActivitiesByUserId = async (userId) => {
    const res = await query("SELECT * FROM activities WHERE user_id = $1 ORDER BY id ASC", [userId]);
    return res.rows;
};

/**
 * Crear una nueva actividad con lógica de auto-nombre ("Actividad N")
 */
const createActivity = async (userId) => {
    // Buscar el número más alto de "Actividad X"
    const res = await query(
        "SELECT name FROM activities WHERE user_id = $1 AND name LIKE 'Actividad %' ORDER BY id DESC",
        [userId]
    );
    
    let nextNumber = 1;
    if (res.rows.length > 0) {
        const names = res.rows.map(r => r.name);
        const numbers = names
            .map(n => parseInt(n.replace('Actividad ', '')))
            .filter(n => !isNaN(n));
        if (numbers.length > 0) {
            nextNumber = Math.max(...numbers) + 1;
        }
    }

    const name = `Actividad ${nextNumber}`;
    const insertRes = await query(
        "INSERT INTO activities (user_id, name) VALUES ($1, $2) RETURNING *",
        [userId, name]
    );
    return insertRes.rows[0];
};

/**
 * Actualizar una actividad
 */
const updateActivity = async (userId, activityId, name, description) => {
    const res = await query(
        "UPDATE activities SET name = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING *",
        [name, description, activityId, userId]
    );
    return res.rows[0];
};

/**
 * Obtener los emisores únicos y su actividad relacionada
 */
const getUserIssuers = async (userId) => {
    // Obtenemos todos los emisores únicos de las facturas
    const invoicesRes = await query(
        "SELECT DISTINCT emisor FROM invoices WHERE user_id = $1 AND emisor IS NOT NULL",
        [userId]
    );
    
    // Obtenemos los mapeos guardados
    const mappingsRes = await query(
        "SELECT emisor_name, activity_id FROM user_issuers WHERE user_id = $1",
        [userId]
    );
    
    const mappings = {};
    mappingsRes.rows.forEach(m => {
        mappings[m.emisor_name] = m.activity_id;
    });

    return invoicesRes.rows.map(row => ({
        name: row.emisor,
        activity_id: mappings[row.emisor] || null
    }));
};

/**
 * Vincular un emisor a una actividad y opcionalmente actualizar el historial
 */
const linkIssuerToActivity = async (userId, emisorName, activityId) => {
    // 1. Guardar/Actualizar el mapeo
    await query(
        `INSERT INTO user_issuers (user_id, emisor_name, activity_id) 
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, emisor_name) 
         DO UPDATE SET activity_id = EXCLUDED.activity_id`,
        [userId, emisorName, activityId]
    );

    // 2. Obtener el nombre de la actividad para registro histórico (opcional pero recomendado por el usuario)
    let activityName = null;
    if (activityId) {
        const actRes = await query("SELECT name FROM activities WHERE id = $1", [activityId]);
        if (actRes.rows.length > 0) activityName = actRes.rows[0].name;
    }

    return { emisorName, activityId, activityName };
};

/**
 * Actualizar el estado de "Otros gastos explotación" de una factura
 */
const updateInvoiceOtherExpense = async (userId, invoiceId, value) => {
    const res = await query(
        "UPDATE invoices SET is_other_expense = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
        [value, invoiceId, userId]
    );
    return res.rows[0];
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
    getInvoiceById,
    updateUserTelegramId,
    getActivitiesByUserId,
    createActivity,
    updateActivity,
    getUserIssuers,
    linkIssuerToActivity,
    updateInvoiceOtherExpense
};
