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
const invoiceAI = require("./services/gemini");
const { execFileSync } = require("child_process");

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

const parseEuroAmount = (value) => {
    if (!value) return 0.0;
    return parseFloat(String(value).replace(/\s/g, "").replace(/\./g, "").replace(",", ".")) || 0.0;
};


const normalizeText = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const extractPdfText = (filePath) => {
    try {
        return execFileSync("pdftotext", [filePath, "-"], { encoding: "utf8", timeout: 10000 });
    } catch (error) {
        console.warn("[UPLOAD] No se pudo extraer texto PDF con pdftotext:", error.message);
        return null;
    }
};

const pdfHasPositiveReq = (filePath, mimeType) => {
    if (mimeType !== "application/pdf") return false;
    const text = extractPdfText(filePath);
    if (!text) return false;
    const normalized = normalizeText(text);
    if (!normalized.includes("r.eq") && !normalized.includes("r eq") && !normalized.includes("recargo")) return false;

    // R.EQ. visible como porcentaje en líneas o resumen. Evitamos tratar como positivo
    // los resúmenes bonificados a cero (p.ej. LogistaPlus usado al 100%).
    const hasPositiveRate = /(?:%R\.EQ\.|R\.EQ\.)[\s\S]{0,80}(?:1[,.]75|5[,.]20)\s*%?/i.test(text)
        || /(?:1[,.]75|5[,.]20)\s*%[\s\S]{0,80}(?:TOTAL\s+IMPUESTOS|TOTAL\s+NETO|IMPORTE)/i.test(text);
    const explicitZeroSummary = /%R\.EQ\.[\s\S]{0,180}IMPORTE\s*\n\s*0[,.]00/i.test(text);
    return hasPositiveRate && !explicitZeroSummary;
};

const extractMursheInvoice = (filePath, mimeType) => {
    if (mimeType !== "application/pdf") return null;

    const text = extractPdfText(filePath);
    if (!text) return null;

    const normalized = normalizeText(text);
    if (!normalized.includes("distribuciones murshe")) return null;

    const headerMatch = text.match(/N[ºo]\s*Factura:\s*([0-9]{2}\s*\/\s*[0-9]+)\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/i)
        || text.match(/N[ºo]\s*Factura\s*[:\-]?\s*([0-9]{2}\s*\/\s*[0-9]+).*?(\d{2})\/(\d{2})\/(\d{4})/is);
    const facturadoMatch = text.match(/Datos de facturaci[oó]n\s*\n\s*([^\n]+)/i);
    const totalsSection = text.match(/Total productos[\s\S]*?Forma de pago:/i)?.[0] || text;
    const euroValues = [...totalsSection.matchAll(/([\d.,]+)\s*€/g)].map(match => {
        const raw = match[1];
        return raw.includes(",") ? parseEuroAmount(raw) : (parseFloat(raw) || 0.0);
    });
    const totals = euroValues.slice(-4);

    if (!headerMatch || totals.length < 4) return null;

    const referencia = headerMatch[1].replace(/\s*\/\s*/, " / ").trim();
    const fecha = `${headerMatch[4]}-${headerMatch[3]}-${headerMatch[2]}`;
    const [subtotal, iva, r_eq, total] = totals;

    return {
        emisor: "Distribuciones Murshe S.L",
        facturado_a: facturadoMatch?.[1]?.trim() || "",
        fecha_emision: fecha,
        referencia,
        subtotal,
        iva,
        r_eq,
        total_impuestos: Number((iva + r_eq).toFixed(2)),
        total
    };
};

const extractCloudVendingInvoice = (filePath, mimeType) => {
    if (mimeType !== "application/pdf") return null;

    const text = extractPdfText(filePath);
    if (!text) return null;

    const normalized = normalizeText(text);
    if (!normalized.includes("cloud vending s.l") && !normalized.includes("cloud vending sl")) return null;
    if (!normalized.includes("cuota de servicios") && !normalized.includes("expendeduria")) return null;

    const periodMatch = text.match(/Facturaci[oó]n:\s*(\d{2})\/(\d{2})\/(\d{4})\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    const cargoMatch = text.match(/Fecha Cargo:\s*\n\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    const baseMatch = text.match(/Total\s+Neto\s+([\d.,]+)\s*€/i)
        || text.match(/Base\s+Imponible[\s\S]{0,220}?([\d.,]+)\s*€\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€/i);
    const ivaMatch = text.match(/Total\s+I\.V\.A\.\s+([\d.,]+)\s*€/i)
        || text.match(/I\.V\.A\.\s*21%\s*\n\s*Total\s+I\.V\.A\.\s*([\d.,]+)\s*€/i)
        || text.match(/Base\s+Imponible[\s\S]{0,220}?([\d.,]+)\s*€\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€/i);
    // En estas facturas aparece una columna llamada "Total" en la línea del servicio
    // y un resumen final "TOTAL". Hay que priorizar el TOTAL final, no el neto/base.
    const totalMatch = text.match(/^\s*TOTAL\s+([\d.,]+)\s*€/m)
        || text.match(/Total\s+I\.V\.A\.[\s\S]{0,120}?^\s*TOTAL\s+([\d.,]+)\s*€/m)
        || text.match(/Base\s+Imponible[\s\S]{0,220}?([\d.,]+)\s*€\s+([\d.,]+)\s*€\s+([\d.,]+)\s*€/i);

    const endDay = periodMatch?.[4];
    const endMonth = periodMatch?.[5];
    const endYear = periodMatch?.[6];
    // Cloud Vending emite un gasto real mensual por la cuota de servicios.
    // Contablemente usamos la fecha de cargo si aparece; la referencia conserva
    // el mes facturado para evitar confundirlo con la autofactura trimestral de Carlos a Cloud Vending.
    const fecha = cargoMatch
        ? `${cargoMatch[3]}-${cargoMatch[2]}-${cargoMatch[1]}`
        : (periodMatch ? `${endYear}-${endMonth}-${endDay}` : "");

    const referencia = periodMatch ? `CLOUD VENDING ${endYear}-${endMonth}` : "CLOUD VENDING";
    const subtotal = parseEuroAmount(baseMatch?.[1]);
    const iva = parseEuroAmount(ivaMatch?.[2] || ivaMatch?.[1]);
    const extractedTotal = parseEuroAmount(totalMatch?.[3] || totalMatch?.[1]);
    const total = (iva > 0 && extractedTotal <= subtotal)
        ? Number((subtotal + iva).toFixed(2))
        : extractedTotal;

    return {
        emisor: "CLOUD VENDING S.L.",
        facturado_a: "CARLOS GOMEZ DE LA CASA",
        fecha_emision: fecha,
        referencia,
        subtotal,
        iva,
        r_eq: 0.0,
        total_impuestos: iva,
        total
    };
};

const extractEstancoPlusInvoice = (filePath, mimeType) => {
    if (mimeType !== "application/pdf") return null;

    const text = extractPdfText(filePath);
    if (!text) return null;

    const normalized = normalizeText(text);
    if (!normalized.includes("estancoplus") && !normalized.includes("estanco plus")) return null;
    if (!normalized.includes("b98986425")) return null;

    const refMatch = text.match(/N[úu]mero\s+Factura\s*#?\s*([A-Z0-9/.-]+)/i)
        || text.match(/Factura\s*#?\s*([A-Z0-9/.-]+)/i);
    const dateMatch = text.match(/Fecha:\s*(\d{4})-(\d{2})-(\d{2})/i)
        || text.match(/Fecha:\s*(\d{2})\/(\d{2})\/(\d{4})/i);

    const baseMatch = text.match(/Base\s+Imponible\s*\n\s*([\d.,]+)\s*€/i);
    const taxesAndTotalMatch = text.match(/total\s+IVA\s*\n\s*([\d.,]+)\s*€\s*\n\s*Total\s*\n\s*([\d.,]+)\s*€/i);
    const ivaMatch = text.match(/21\s*%\s*\n\s*([\d.,]+)\s*€/i);
    const rEqMatch = text.match(/5[,.]20\s*%\s*\n\s*([\d.,]+)\s*€/i);
    const productsMatch = text.match(/Productos\s*\n\s*([\d.,]+)\s*€/i);
    const discountMatch = text.match(/Total\s+Descuentos\s*\n\s*(-?\s*[\d.,]+)\s*€/i)
        || text.match(/Total\s+cupones\s*\n\s*(-?\s*[\d.,]+)\s*€/i);

    const referencia = refMatch?.[1]?.replace(/^#/, "").trim();
    const fecha_emision = dateMatch
        ? (dateMatch[1].length === 4
            ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
            : `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`)
        : "";
    const subtotal = parseEuroAmount(baseMatch?.[1]);
    const iva = parseEuroAmount(ivaMatch?.[1]);
    const r_eq = parseEuroAmount(rEqMatch?.[1]);
    const total_impuestos = parseEuroAmount(taxesAndTotalMatch?.[1]) || Number((iva + r_eq).toFixed(2));
    const total = parseEuroAmount(taxesAndTotalMatch?.[2]);

    if (!referencia || !fecha_emision || !subtotal || !total) return null;

    return {
        emisor: "Estanco Plus S.L.",
        facturado_a: "Carlos Gomez De La Casa",
        fecha_emision,
        referencia,
        subtotal,
        iva,
        r_eq,
        total_impuestos,
        total,
        base_productos: parseEuroAmount(productsMatch?.[1]),
        total_descuentos: parseEuroAmount(discountMatch?.[1]),
        local_rule: "estancoplus"
    };
};

const extractLogistaInvoice = (filePath, mimeType) => {
    if (mimeType !== "application/pdf") return null;

    const text = extractPdfText(filePath);
    if (!text) return null;

    const normalized = normalizeText(text);
    if (!normalized.includes("logista")) return null;

    const parseDate = (raw) => {
        const match = String(raw || "").match(/(\d{2})[\/.](\d{2})[\/.](\d{4})/);
        return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
    };
    const amountAfter = (labelRegex, source = text) => {
        const match = source.match(labelRegex);
        return match ? parseEuroAmount(match[1]) : 0.0;
    };

    const isRetail = normalized.includes("logista retail");
    const emisor = isRetail ? "Logista Retail, S.A." : "LOGISTA, S.A.U.";

    const referenceMatch = text.match(/N[ªº]\s*([0-9]{10}(?:-\d{5})?)/i)
        || text.match(/N[ºo]\s*\n\s*HOJA[\s\S]{0,160}?\n\s*([0-9]{10})\s*\n\s*1\s+DE\s+1/i)
        || text.match(/\b([0-9]{10}-\d{5})\b/)
        || text.match(/\b([0-9]{10})\b/);
    const referencia = referenceMatch?.[1]?.trim();
    if (!referencia) return null;

    const emissionSection = text.match(/FEC\.\s*EMISI[OÓ]N[\s\S]{0,180}?(\d{2}[\/.]\d{2}[\/.]\d{4})/i);
    const fecha_emision = parseDate(emissionSection?.[1]) || parseDate(text.match(/\b\d{2}[\/.]\d{2}[\/.]\d{4}\b/)?.[0]);
    if (!fecha_emision) return null;

    if (isRetail) {
        const retailSubtotalMatch = text.match(/TOTAL\s+SUMA\s+Y\s+SIGUE[\s\S]{0,160}?([\d.,]+)\s*\n\s*\n\s*DESCUENTOS\s+GLOBALES/i);
        const retailTaxSumsMatch = text.match(/TOTAL\s+IMPUESTOS[\s\S]{0,700}?_{6,}\s*\n\s*([\d.,]+)\s*\n\s*([\d.,]+)\s*\n\s*TOTAL/i);
        const retailTotalMatch = text.match(/Total\s+EUR\s*\n\s*([\d.,]+)/i)
            || text.match(/TOTAL\s*\n\s*([\d.,]+)\s*\n\s*SERVICIO\s+POSTVENTA/i);
        if (retailSubtotalMatch && retailTaxSumsMatch && retailTotalMatch) {
            const subtotal = parseEuroAmount(retailSubtotalMatch[1]);
            const iva = parseEuroAmount(retailTaxSumsMatch[1]);
            const r_eq = parseEuroAmount(retailTaxSumsMatch[2]);
            const total = parseEuroAmount(retailTotalMatch[1]);
            return {
                emisor,
                facturado_a: "GOMEZ DE LA CASA, CARLOS",
                fecha_emision,
                referencia,
                subtotal,
                iva,
                r_eq,
                total_impuestos: Number((iva + r_eq).toFixed(2)),
                total,
                local_rule: "logista_retail"
            };
        }

        const retailTotals = text.match(/TOTAL\s+IMPUESTOS\s*\n\s*([\d.,]+)[\s\S]{0,500}?_{6,}\s*\n\s*_{6,}\s*\n\s*([\d.,]+)\s*\n\s*([\d.,]+)\s*\n\s*TOTAL\s*\n\s*([\d.,]+)\s*\n\s*([\d.,]+)/i);
        if (retailTotals) {
            return {
                emisor,
                facturado_a: "GOMEZ DE LA CASA, CARLOS",
                fecha_emision,
                referencia,
                subtotal: parseEuroAmount(retailTotals[1]),
                iva: parseEuroAmount(retailTotals[2]),
                r_eq: parseEuroAmount(retailTotals[3]),
                total_impuestos: parseEuroAmount(retailTotals[4]),
                total: parseEuroAmount(retailTotals[5]),
                local_rule: "logista_retail"
            };
        }
    }

    const total = amountAfter(/LIQUIDO\s+EUROS\s*\n\s*([\d.,]+)/i)
        || amountAfter(/TOTAL\s*\n\s*EUROS\s*\n\s*([\d.,]+)/i)
        || amountAfter(/TOTAL\s*\n\s*([\d.,]+)\s*\n\s*IMPORTE/i)
        || amountAfter(/Total\s+EUR\s*\n\s*([\d.,]+)/i);
    if (!total) return null;

    const subtotal = amountAfter(/BASE\s*\n\s*%IVA\s*\n\s*([\d.,]+)\s*\n\s*21[,.]00/i)
        || amountAfter(/BASE\s+IMPONIBLE\s*\n\s*([\d.,]+)\b/i)
        || amountAfter(/BASE\s+IMPONIBLE\s*\n\s*%IVA\s*\n\s*([\d.,]+)\s*\n\s*21[,.]00/i);
    const total_impuestos = amountAfter(/TOTAL\s+IMPUESTOS\s*\n\s*([\d.,]+)/i);
    const taxSummary = text.match(/BASE\s+IMPONIBLE[\s\S]{0,900}?TOTAL\s+(?:NETO|IMPUESTOS)/i)?.[0] || text;
    const rEqRateMatch = taxSummary.match(/%R\.EQ\.\s*\n\s*(1[,.]75|5[,.]20)/i)
        || taxSummary.match(/\b(1[,.]75|5[,.]20)\s*%\s*\n\s*[_\d.,-]*\s*\n\s*TOTAL\s+(?:IMPUESTOS|NETO)/i);
    const rEqRate = rEqRateMatch ? parseFloat(rEqRateMatch[1].replace(",", ".")) : 0;
    const rEqDirect = amountAfter(/%R\.EQ\.\s*\n\s*(?:1[,.]75|5[,.]20)[\s\S]{0,140}?IMPORTE\s*\n\s*([\d.,]+)/i, taxSummary)
        || amountAfter(/%R\.EQ\.[\s\S]{0,80}?IMPORTE\s*\n\s*([\d.,]+)\s*\n\s*_{6,}/i, taxSummary);
    const rEqCalculated = (!rEqDirect && subtotal && rEqRate) ? Number((subtotal * rEqRate / 100).toFixed(2)) : 0.0;
    const ivaDirect = amountAfter(/%IVA\s*\n\s*21[,.]00[\s\S]{0,140}?IMPORTE\s*\n\s*([\d.,]+)/i, taxSummary)
        || amountAfter(/BASE\s+IMPONIBLE[\s\S]{0,120}?IMPORTE\s*\n\s*([\d.,]+)\s*\n\s*[_\d.,-]+[\s\S]{0,180}?%IVA\s*\n\s*21[,.]00/i, taxSummary);
    const r_eq = rEqDirect || rEqCalculated || 0.0;
    const iva = (total_impuestos && r_eq ? Number((total_impuestos - r_eq).toFixed(2)) : 0.0)
        || ivaDirect
        || (subtotal ? Number((subtotal * 0.21).toFixed(2)) : 0.0)
        || amountAfter(/BASE\s+IMPONIBLE[\s\S]{0,180}?%R\.EQ\.[\s\S]{0,80}?([\d.,]+)\s*\n\s*[_\d.,-]+\s*\n\s*[_\d.,-]+\s*\n\s*1[,.]75/i)
        || amountAfter(/BASE\s+IMPONIBLE[\s\S]{0,80}?%IVA\s*\n\s*[\d.,]+\s*\n\s*21[,.]00[\s\S]{0,80}?%R\.EQ\.\s*\n\s*([\d.,]+)/i);

    return {
        emisor,
        facturado_a: "GOMEZ DE LA CASA, CARLOS",
        fecha_emision,
        referencia,
        subtotal,
        iva,
        r_eq,
        total_impuestos: total_impuestos || Number((iva + r_eq).toFixed(2)),
        total
    };
};


const extractAldistaInvoice = (filePath, mimeType) => {
    if (mimeType !== "application/pdf") return null;

    const text = extractPdfText(filePath);
    if (!text) return null;

    const normalized = normalizeText(text);
    if (!normalized.includes("aldista 2000")) return null;

    const headerMatch = text.match(/FACTURA\s*\n\s*FECHA[\s\S]{0,80}?\n\s*([0-9]+-[0-9]+)\s*\n\s*(\d{2})\/(\d{2})\/(\d{4})/i);
    const referencia = headerMatch?.[1];
    const fecha_emision = headerMatch ? `${headerMatch[4]}-${headerMatch[3]}-${headerMatch[2]}` : "";

    const subtotal = parseEuroAmount(text.match(/Bruto\s*\n\s*([\d.,]+)\s*€/i)?.[1])
        || parseEuroAmount(text.match(/Base\s*\n\s*([\d.,]+)/i)?.[1]);
    const iva = parseEuroAmount(text.match(/IVA\s*%\s*\n\s*21\s*\n\s*Impuesto\s*\n\s*([\d.,]+)\s*€/i)?.[1])
        || parseEuroAmount(text.match(/Impuestos\s*\n\s*([\d.,]+)\s*€/i)?.[1]);
    const r_eq = parseEuroAmount(text.match(/RE%\s*\n\s*Impuesto\s*\n\s*([\d.,]+)\s*€/i)?.[1])
        || parseEuroAmount(text.match(/Retenci[oó]n\s*\n\s*[\d.,]+\s*€\s*\n\s*R\.E\s*\n\s*([\d.,]+)\s*€/i)?.[1]);
    const total = parseEuroAmount(text.match(/Forma\s+pago\s*\n\s*([\d.,]+)\s*€/i)?.[1])
        || parseEuroAmount(text.match(/pendiente\s+([\d.,]+)/i)?.[1]);

    if (!referencia || !fecha_emision || !subtotal || !total) return null;

    return {
        emisor: "ALDISTA 2000, S.L.",
        facturado_a: "GOMEZ DE LA CASA, CARLOS",
        fecha_emision,
        referencia,
        subtotal,
        iva,
        r_eq,
        total_impuestos: Number((iva + r_eq).toFixed(2)),
        total,
        local_rule: "aldista"
    };
};


const extractIberdrolaInvoice = (filePath, mimeType) => {
    if (mimeType !== "application/pdf") return null;

    const text = extractPdfText(filePath);
    if (!text) return null;

    const normalized = normalizeText(text);
    if (!normalized.includes("iberdrola clientes")) return null;
    if (!normalized.includes("factura de") || !normalized.includes("electricidad")) return null;

    const parseDate = (raw) => {
        const monthMap = {
            enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
            julio: "07", agosto: "08", septiembre: "09", setiembre: "09", octubre: "10", noviembre: "11", diciembre: "12"
        };
        const textValue = normalizeText(raw);
        const longMatch = textValue.match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i);
        if (longMatch && monthMap[longMatch[2]]) {
            return `${longMatch[3]}-${monthMap[longMatch[2]]}-${String(longMatch[1]).padStart(2, "0")}`;
        }
        const shortMatch = String(raw || "").match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
        return shortMatch ? `${shortMatch[3]}-${String(shortMatch[2]).padStart(2, "0")}-${String(shortMatch[1]).padStart(2, "0")}` : "";
    };

    const summarySection = text.match(/RESUMEN\s+DE\s+FACTURA[\s\S]{0,1800}?ENERG[IÍ]A/i)?.[0] || text;
    const referencia = summarySection.match(/\b(\d{14,})\b/)?.[1];
    const fecha_emision = parseDate(summarySection.match(/(\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+\s+de\s+\d{4})/i)?.[1])
        || parseDate(text.match(/FECHA\s+DE\s+EMISI[OÓ]N:\s*\n\s*([^\n]+)/i)?.[1]);

    // Iberdrola muestra varios totales parciales: TOTAL ENERGÍA, TOTAL SERVICIOS,
    // etc. El importe de factura válido es "TOTAL IMPORTE FACTURA"; la base antes
    // de IVA es "IMPORTE TOTAL".
    const subtotal = parseEuroAmount(text.match(/IMPORTE\s+TOTAL\s*\n\s*([\d.,]+)\s*€/i)?.[1]);
    const iva = parseEuroAmount(text.match(/IVA\s*\n\s*21\s*%\s*s\/[\s\S]{0,80}?\n\s*([\d.,]+)\s*€/i)?.[1])
        || parseEuroAmount(text.match(/IVA[\s\S]{0,80}?([\d.,]+)\s*€\s*\n\s*TOTAL/i)?.[1]);
    const total = parseEuroAmount(text.match(/TOTAL\s+IMPORTE\s+FACTURA\s*\n\s*([\d.,]+)\s*€/i)?.[1])
        || parseEuroAmount(text.match(/TOTAL\s*\n\s*(?:FECHA\s+PREVISTA[\s\S]{0,80})?([\d.,]+)\s*€/i)?.[1]);

    if (!referencia || !fecha_emision || !subtotal || !iva || !total) return null;

    return {
        emisor: "IBERDROLA CLIENTES, S.A.U.",
        facturado_a: "CARLOS GOMEZ DE LA CASA",
        fecha_emision,
        referencia,
        subtotal,
        iva,
        r_eq: 0.0,
        total_impuestos: iva,
        total,
        local_rule: "iberdrola"
    };
};

const validateInvoiceConsistency = (result) => {
    if (!result || result.needs_review) return "";

    const normalizedEmitter = normalizeText(result.emisor || "");
    // Algunos proveedores tienen conceptos no representados como base+IVA+R.EQ.
    // (premios, descuentos, líquido final, cupones). Esos se validan con reglas
    // específicas para no generar falsos avisos.
    if (normalizedEmitter.includes("logista") || result.local_rule === "estancoplus") return "";

    const subtotal = Number(result.subtotal || 0);
    const iva = Number(result.iva || 0);
    const rEq = Number(result.r_eq || 0);
    const total = Number(result.total || 0);
    const expectedTotal = Number((subtotal + iva + rEq).toFixed(2));

    if (subtotal > 0 && total > 0 && Math.abs(expectedTotal - total) > 0.05) {
        return `Aviso: La factura no cuadra aritméticamente (base ${subtotal.toFixed(2)} + IVA ${iva.toFixed(2)} + R.EQ. ${rEq.toFixed(2)} = ${expectedTotal.toFixed(2)}, pero el total leído es ${total.toFixed(2)}). Revísala antes de darla por buena. `;
    }

    return "";
};


const getTodayISODate = () => new Date().toISOString().slice(0, 10);

const buildPendingInvoiceData = (file) => ({
    emisor: "PENDIENTE DE REVISAR",
    facturado_a: "",
    fecha_emision: getTodayISODate(),
    referencia: `PENDIENTE-${Date.now()}-${String(file?.originalname || "factura").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60)}`,
    subtotal: 0.0,
    iva: 0.0,
    r_eq: 0.0,
    total_impuestos: 0.0,
    total: 0.0,
    needs_review: true,
    original_filename: file?.originalname || ""
});

const extractGenericTextPdfInvoice = (filePath, mimeType) => {
    if (mimeType !== "application/pdf") return null;

    const text = extractPdfText(filePath);
    if (!text) return null;

    const normalized = normalizeText(text);
    if (!normalized.includes("factura") && !normalized.includes("invoice")) return null;

    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const parseDate = (raw) => {
        const match = String(raw || "").match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
        if (!match) return "";
        return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
    };
    const amountFromMatch = (regex) => {
        const match = text.match(regex);
        return match ? parseEuroAmount(match[1]) : 0.0;
    };

    const total = amountFromMatch(/TOTAL\s+IMPORTE\s+FACTURA\D{0,80}([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i)
        || amountFromMatch(/(?:TOTAL\s*(?:FACTURA|EUR|EUROS)?|IMPORTE\s+TOTAL|TOTAL\s+A\s+PAGAR)\D{0,80}([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i);
    if (!total) return null;

    const fecha_emision = parseDate(text.match(/(?:fecha\s*(?:emisi[oó]n|factura)?|date)\D{0,60}(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i)?.[1])
        || parseDate(text.match(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}\b/)?.[0])
        || getTodayISODate();

    const ref = text.match(/(?:n[ºoª]?\s*(?:factura|invoice)?|factura\s*n[ºoª]?|referencia)\D{0,40}([A-Z0-9][A-Z0-9\/.\- ]{2,40})/i)?.[1]
        ?.replace(/\s+/g, " ")
        ?.trim();

    const subtotal = amountFromMatch(/(?:base\s+imponible|subtotal|base)\D{0,60}([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i);
    const iva = amountFromMatch(/(?:iva|i\.v\.a\.)\D{0,60}([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i);
    const r_eq = amountFromMatch(/(?:r\.\s*eq\.?|recargo\s+de\s+equivalencia)\D{0,80}([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})/i);

    const emisor = lines.find(line => /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(line) && !/^factura\b/i.test(line) && !/^n[ºoª]/i.test(line)) || "PENDIENTE DE REVISAR";

    return {
        emisor: emisor.slice(0, 120),
        facturado_a: "",
        fecha_emision,
        referencia: ref || `PDF-${Date.now()}`,
        subtotal,
        iva,
        r_eq,
        total_impuestos: Number((iva + r_eq).toFixed(2)),
        total,
        generic_extraction: true
    };
};


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

        const isZipUpload = req.file.mimetype === "application/zip"
            || req.file.mimetype === "application/x-zip-compressed"
            || /\.zip$/i.test(req.file.originalname || "");
        if (isZipUpload) {
            if (req.file?.path && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (cleanupError) { console.error("[UPLOAD] No se pudo borrar ZIP no admitido:", cleanupError); }
            }
            return res.status(400).json({
                warning: true,
                message: "El archivo ZIP no se ha guardado como factura. Sube el PDF de la factura para evitar entradas pendientes o duplicadas."
            });
        }

        const userFetch = await db.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
        const userData = userFetch.rows[0];

        if (!userData) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        // Para el motor IA/OCR necesitamos leer el archivo
        const fileBase64 = fs.readFileSync(req.file.path).toString("base64");

        const fileData = [{
            data: fileBase64,
            mimeType: req.file.mimetype,
            filename: req.file.originalname
        }];

        let result = extractMursheInvoice(req.file.path, req.file.mimetype);
        if (result) {
            console.log("[UPLOAD] Factura Murshe extraída por regla local:", result.referencia, result.total);
        } else {
            result = extractCloudVendingInvoice(req.file.path, req.file.mimetype);
            if (result) {
                console.log("[UPLOAD] Factura Cloud Vending extraída por regla local:", result.referencia, result.total);
            } else {
                result = extractEstancoPlusInvoice(req.file.path, req.file.mimetype);
                if (result) {
                    console.log("[UPLOAD] Factura EstancoPlus extraída por regla local:", result.referencia, result.total);
                } else {
                    result = extractLogistaInvoice(req.file.path, req.file.mimetype);
                    if (result) {
                        console.log("[UPLOAD] Factura Logista extraída por regla local:", result.referencia, result.total);
                    } else {
                        result = extractIberdrolaInvoice(req.file.path, req.file.mimetype);
                        if (result) {
                            console.log("[UPLOAD] Factura Iberdrola extraída por regla local:", result.referencia, result.total);
                        } else {
                            result = extractAldistaInvoice(req.file.path, req.file.mimetype);
                            if (result) {
                                console.log("[UPLOAD] Factura Aldista extraída por regla local:", result.referencia, result.total);
                            } else {
                                result = extractGenericTextPdfInvoice(req.file.path, req.file.mimetype);
                                if (result) {
                                    console.log("[UPLOAD] Factura extraída por regla genérica local:", result.referencia, result.total);
                                } else {
                                    console.log("[UPLOAD] Enviando a motor IA/OCR...");
                                    try {
                                        result = await invoiceAI.extractInvoiceData(fileData, userData.r_eq);
                                        result = db.prepareInvoiceData(result, result);
                                        console.log("[UPLOAD] Resultado IA recibido:", result.emisor, result.total);
                                    } catch (aiError) {
                                        console.error("[UPLOAD] IA/OCR no disponible; guardando factura pendiente de revisar:", aiError.message);
                                        result = buildPendingInvoiceData(req.file);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        let warningMessage = "";
        if (result.needs_review) {
            warningMessage = "La factura se ha guardado, pero el OCR/IA no pudo leer los datos. Queda como PENDIENTE DE REVISAR para completarla manualmente; no se ha perdido el archivo. ";
        } else {
            // Validaciones de duplicados después de aplicar reglas de normalización.
            const duplicateInvoice = await db.checkDuplicateInvoice(userData.id, result, result);
            if (duplicateInvoice.invoice) {
                const duplicateRefText = duplicateInvoice.invoice.reference || result.referencia;
                if (req.file?.path && fs.existsSync(req.file.path)) {
                    try { fs.unlinkSync(req.file.path); } catch (cleanupError) { console.error("[UPLOAD] No se pudo borrar temporal duplicado:", cleanupError); }
                }
                return res.json({ 
                    warning: true, 
                    message: `La factura "${duplicateRefText}" ya existe en tu historial. No se ha guardado de nuevo para evitar duplicidad.`,
                    invoice: result
                });
            }

            const duplicateAmount = await db.checkDuplicateAmountDate(userData.id, result.total, result.fecha_emision);
            if (duplicateAmount) {
                warningMessage = "Aviso: Se ha detectado otra factura con el mismo importe y fecha. ";
            }

            warningMessage += validateInvoiceConsistency(result);

            // Alarma de Recargo de Equivalencia (R.EQ). Solo avisamos como incidencia
            // cuando el PDF muestra R.EQ. positivo pero el extractor lo ha dejado a cero;
            // así evitamos falsos avisos en seguros, cuotas, bonificaciones a 0, etc.
            const hasPositiveReqInPdf = pdfHasPositiveReq(req.file.path, req.file.mimetype);
            if (userData.r_eq && hasPositiveReqInPdf && (!result.r_eq || parseFloat(result.r_eq) <= 0)) {
                warningMessage += "¡Atención!: La factura parece tener Recargo de Equivalencia (R.EQ.), pero no se ha podido extraer el importe. Revísala antes de darla por buena. ";
            }
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
        if (req.file?.path && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (cleanupError) { console.error("[UPLOAD] No se pudo borrar temporal:", cleanupError); }
        }
        res.status(500).json({ error: "Error al procesar la factura con IA/OCR: " + error.message });
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
