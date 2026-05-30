const { Pool } = require("pg");

const VALID_INVOICE_TYPES = ['expense', 'income', 'other_expense', 'labor_expense', 'other_income'];

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
 * Obtener el nombre canónico de un emisor basado en reglas conocidas y similitud.
 * Evita duplicados por acentos, puntuación o prefijos comerciales como COMET.
 */
const normalizeIssuerName = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const getRawInvoiceText = (...values) => values
    .filter(value => value !== null && value !== undefined)
    .map(value => typeof value === "string" ? value : JSON.stringify(value))
    .join(" ");

const isGestoraComercialMixtosInvoice = (data, rawResponse) => {
    const rawText = normalizeIssuerName(getRawInvoiceText(data, rawResponse));
    return rawText.includes("gestora comercial de los mixtos")
        && (rawText.includes("auto factura") || rawText.includes("autofactura") || rawText.includes("amz"));
};

const applyGestoraComercialMixtosRule = (data, rawResponse) => {
    if (!isGestoraComercialMixtosInvoice(data, rawResponse)) return data;

    const rawReferencia = String(data?.referencia || "").trim();
    const match = rawReferencia.match(/(?:AMZ\s*)?(\d+)/i);
    const referencia = match ? `AMZ ${match[1]}` : rawReferencia;

    return {
        ...data,
        emisor: "GESTORA COMERCIAL DE LOS MIXTOS S.L.U.",
        referencia,
    };
};

const applyCarlosGomezInvoiceLabel = (emisor, data, rawResponse) => {
    const normalizedEmisor = normalizeIssuerName(emisor);
    const rawText = normalizeIssuerName(getRawInvoiceText(data, rawResponse));
    const hasCarlos = normalizedEmisor === "carlos gomez de la casa" || rawText.includes("carlos gomez de la casa");

    // Algunas autofacturas de Carlos se leen al revés: Gemini puede tomar el
    // cliente/facturado a como emisor. Si en el documento aparecen Carlos y el
    // cliente conocido, mantenemos a Carlos como emisor con su etiqueta.
    if (!hasCarlos) return emisor;

    if (rawText.includes("celeritas") && rawText.includes("transporte")) {
        return "CARLOS GOMEZ DE LA CASA (Celeritas)";
    }

    if (rawText.includes("cloud vending") || rawText.includes("cloud vendig")) {
        return "CARLOS GOMEZ DE LA CASA (Cloud vending)";
    }

    return emisor;
};

const getQuarterEndDate = (year, quarter) => {
    const quarterEnds = {
        1: `${year}-03-31`,
        2: `${year}-06-30`,
        3: `${year}-09-30`,
        4: `${year}-12-31`,
    };
    return quarterEnds[quarter] || null;
};

const getCloudVendingQuarterEndDate = (data, rawResponse) => {
    const rawOriginal = getRawInvoiceText(data, rawResponse);
    const rawNormalized = normalizeIssuerName(rawOriginal);

    const yearMatch = rawOriginal.match(/\b(20\d{2})\b/);
    const year = yearMatch ? Number(yearMatch[1]) : null;

    if (year) {
        if (rawNormalized.includes("primer trimestre") || rawNormalized.includes("1 trimestre") || rawNormalized.includes("1er trimestre")) return getQuarterEndDate(year, 1);
        if (rawNormalized.includes("segundo trimestre") || rawNormalized.includes("2 trimestre")) return getQuarterEndDate(year, 2);
        if (rawNormalized.includes("tercer trimestre") || rawNormalized.includes("3 trimestre") || rawNormalized.includes("3er trimestre")) return getQuarterEndDate(year, 3);
        if (rawNormalized.includes("cuarto trimestre") || rawNormalized.includes("4 trimestre")) return getQuarterEndDate(year, 4);
    }

    const periodMatch = rawOriginal.match(/\b\d{1,2}[\/-]\d{1,2}[\/-](20\d{2})\s*-\s*(\d{1,2})[\/-](\d{1,2})[\/-](20\d{2})\b/);
    if (periodMatch) {
        const [, , endDay, endMonth, endYear] = periodMatch;
        return `${endYear}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    }

    if (data?.fecha_emision && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha_emision)) {
        const [dateYear, month] = data.fecha_emision.split("-").map(Number);
        return getQuarterEndDate(dateYear, Math.ceil(month / 3));
    }

    return null;
};

const prepareInvoiceData = (data, rawResponse) => {
    const prepared = applyGestoraComercialMixtosRule({ ...data }, rawResponse);

    prepared.emisor = applyCarlosGomezInvoiceLabel(prepared.emisor, prepared, rawResponse);

    if (prepared.emisor === "CARLOS GOMEZ DE LA CASA (Cloud vending)") {
        prepared.fecha_emision = getCloudVendingQuarterEndDate(prepared, rawResponse) || prepared.fecha_emision;
    }

    return prepared;
};

const getCanonicalEmisor = async (userId, newName) => {
    if (!newName) return newName;

    const normalizedNewName = normalizeIssuerName(newName);

    // Regla específica: COMET / Compañía de Tabacos del Mediterráneo.
    // Sugarland también contiene "mediterraneo", por eso exigimos "tabacos" o "comet".
    if ((normalizedNewName.includes("comet") || normalizedNewName.includes("tabacos"))
        && normalizedNewName.includes("mediterraneo")) {
        return "COMET";
    }
    
    // Obtener todos los emisores únicos del usuario
    const res = await query(
        "SELECT DISTINCT emisor FROM invoices WHERE user_id = $1 AND emisor IS NOT NULL",
        [userId]
    );
    
    const existingIssuers = res.rows.map(r => r.emisor);
    let bestMatch = newName;
    let minDistance = 3; // Buscamos distancia <= 2

    for (const existing of existingIssuers) {
        const normalizedExisting = normalizeIssuerName(existing);
        if (normalizedExisting === normalizedNewName) return existing;

        const distance = getLevenshteinDistance(normalizedNewName, normalizedExisting);
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
    data = prepareInvoiceData(data, rawResponse);

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

    // Buscar si el emisor tiene una actividad y tipo de factura pre-asignados
    const mappingRes = await query(
        `SELECT a.name, COALESCE(ui.invoice_type, 'expense') AS invoice_type
         FROM user_issuers ui
         LEFT JOIN activities a ON a.id = ui.activity_id
         WHERE ui.user_id = $1 AND ui.emisor_name = $2`,
        [userId, emisor]
    );
    
    let activityName = mappingRes.rows.length > 0 ? mappingRes.rows[0].name : null;
    let invoiceType = mappingRes.rows.length > 0 ? mappingRes.rows[0].invoice_type : 'expense';
    if (!VALID_INVOICE_TYPES.includes(invoiceType)) invoiceType = 'expense';

    const text = `
    INSERT INTO invoices (
      user_id, emisor, invoice_date, reference, subtotal, iva, r_eq, total_taxes, total, ingestion_channel, raw_ai_response, file_path, actividad, invoice_type
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *;
  `;
    const values = [
        userId, emisor, fecha_emision, referencia, subtotal, iva, r_eq, total_impuestos, total, channel, rawResponse, filePath, activityName, invoiceType
    ];

    console.log("[DB] Guardando factura - Canal:", channel, "Ref:", referencia, "Actividad:", activityName, "Tipo:", invoiceType);
    const res = await query(text, values);
    return res.rows[0];
};

/**
 * Verificar duplicado por referencia
 */
const checkDuplicateReference = async (userId, reference) => {
    if (!reference) return null;
    const normalizedReference = String(reference).trim().replace(/\s+/g, " ").toUpperCase();
    const res = await query(
        `SELECT * FROM invoices
         WHERE user_id = $1
           AND upper(regexp_replace(trim(reference), '\\s+', ' ', 'g')) = $2`,
        [userId, normalizedReference]
    );
    return res.rows[0];
};

/**
 * Verificar duplicado fuerte: misma referencia normalizada o mismo emisor, fecha e importe.
 */
const checkDuplicateInvoice = async (userId, data, rawResponse = data) => {
    const prepared = prepareInvoiceData(data, rawResponse);
    const duplicateRef = await checkDuplicateReference(userId, prepared.referencia);
    if (duplicateRef) return { reason: "reference", invoice: duplicateRef, prepared };

    if (prepared.emisor && prepared.fecha_emision && prepared.total !== undefined && prepared.total !== null) {
        const res = await query(
            `SELECT * FROM invoices
             WHERE user_id = $1
               AND emisor = $2
               AND invoice_date = $3
               AND total = $4
             ORDER BY id DESC
             LIMIT 1`,
            [userId, prepared.emisor, prepared.fecha_emision, prepared.total]
        );
        if (res.rows[0]) return { reason: "same_emisor_date_total", invoice: res.rows[0], prepared };
    }

    return { reason: null, invoice: null, prepared };
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
        "SELECT emisor_name, activity_id, COALESCE(invoice_type, 'expense') AS invoice_type FROM user_issuers WHERE user_id = $1",
        [userId]
    );
    
    const mappings = {};
    mappingsRes.rows.forEach(m => {
        mappings[m.emisor_name] = {
            activity_id: m.activity_id,
            invoice_type: m.invoice_type || 'expense'
        };
    });

    return invoicesRes.rows.map(row => ({
        name: row.emisor,
        activity_id: mappings[row.emisor]?.activity_id || null,
        invoice_type: mappings[row.emisor]?.invoice_type || 'expense'
    }));
};

/**
 * Vincular un emisor a una actividad y opcionalmente actualizar el historial
 */
const linkIssuerToActivity = async (userId, emisorName, activityId, invoiceType = 'expense') => {
    if (!VALID_INVOICE_TYPES.includes(invoiceType)) invoiceType = 'expense';

    // 1. Guardar/Actualizar el mapeo
    await query(
        `INSERT INTO user_issuers (user_id, emisor_name, activity_id, invoice_type) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, emisor_name) 
         DO UPDATE SET activity_id = EXCLUDED.activity_id, invoice_type = EXCLUDED.invoice_type`,
        [userId, emisorName, activityId || null, invoiceType]
    );

    // 2. Obtener el nombre de la actividad para registro histórico (opcional pero recomendado por el usuario)
    let activityName = null;
    if (activityId) {
        const actRes = await query("SELECT name FROM activities WHERE id = $1", [activityId]);
        if (actRes.rows.length > 0) activityName = actRes.rows[0].name;
    }

    // 3. Aplicar la relación también al histórico de ese emisor
    await query(
        "UPDATE invoices SET actividad = $1, invoice_type = $2 WHERE user_id = $3 AND emisor = $4",
        [activityName, invoiceType, userId, emisorName]
    );

    return { emisorName, activityId, activityName, invoiceType };
};

/**
 * Actualizar el estado de "Exportar IVA" de una factura
 */
const updateInvoiceOtherExpense = async (userId, invoiceId, value) => {
    const res = await query(
        "UPDATE invoices SET is_other_expense = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
        [value, invoiceId, userId]
    );
    return res.rows[0];
};

/**
 * Actualizar el campo actividad de una factura individual
 */
const updateInvoiceActivity = async (userId, invoiceId, activityName) => {
    const res = await query(
        "UPDATE invoices SET actividad = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
        [activityName, invoiceId, userId]
    );
    return res.rows[0];
};

/**
 * Actualizar el tipo de factura individual
 */
const updateInvoiceType = async (userId, invoiceId, invoiceType) => {
    if (!VALID_INVOICE_TYPES.includes(invoiceType)) {
        throw new Error("Tipo de factura inválido");
    }
    const res = await query(
        "UPDATE invoices SET invoice_type = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
        [invoiceType, invoiceId, userId]
    );
    return res.rows[0];
};

module.exports = {
    query,
    findUserByTelegramId,
    findUserByPhone,
    findUserByEmail,
    prepareInvoiceData,
    saveInvoice,
    checkDuplicateReference,
    checkDuplicateInvoice,
    checkDuplicateAmountDate,
    deleteInvoice,
    getInvoiceById,
    updateUserTelegramId,
    getActivitiesByUserId,
    createActivity,
    updateActivity,
    getUserIssuers,
    linkIssuerToActivity,
    updateInvoiceOtherExpense,
    updateInvoiceActivity,
    updateInvoiceType
};
