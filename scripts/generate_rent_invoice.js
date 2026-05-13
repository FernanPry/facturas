#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
require('/home/charly/facturas/backend/node_modules/dotenv').config({ path: '/home/charly/facturas/backend/.env' });
const { Pool } = require('/home/charly/facturas/backend/node_modules/pg');
const PDFDocument = require('/home/charly/facturas/backend/node_modules/pdfkit');

const CONFIG = {
  userId: 2,
  issuer: 'Ignacio Gómez Martín',
  customer: 'Carlos Gómez de la Casa',
  concept: 'Alquiler',
  subtotal: 1000.00,
  ivaRate: 0.21,
  uploadDir: '/home/charly/facturas/backend/uploads/2',
};

function parseArgs() {
  const args = Object.fromEntries(process.argv.slice(2).map(arg => {
    const [k, ...rest] = arg.replace(/^--/, '').split('=');
    return [k, rest.join('=') || true];
  }));
  return args;
}

function firstOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function fmtDate(date) {
  return date.toISOString().slice(0, 10);
}

function fmtMonth(date) {
  return date.toISOString().slice(0, 7);
}

function eur(amount) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}

function drawInvoicePdf(filePath, invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const out = fs.createWriteStream(filePath);
    doc.pipe(out);

    doc.fontSize(22).text('FACTURA', { align: 'right' });
    doc.moveDown();
    doc.fontSize(11).text(`Referencia: ${invoice.reference}`, { align: 'right' });
    doc.text(`Fecha: ${invoice.date}`, { align: 'right' });

    doc.moveDown(2);
    doc.fontSize(12).text('Emisor', { underline: true });
    doc.fontSize(11).text(CONFIG.issuer);
    doc.moveDown();
    doc.fontSize(12).text('Cliente', { underline: true });
    doc.fontSize(11).text(CONFIG.customer);

    doc.moveDown(2);
    doc.fontSize(12).text('Concepto', 50, 260);
    doc.text('Base imponible', 310, 260, { width: 100, align: 'right' });
    doc.text('IVA', 420, 260, { width: 60, align: 'right' });
    doc.text('Total', 500, 260, { width: 60, align: 'right' });
    doc.moveTo(50, 280).lineTo(560, 280).stroke();

    doc.fontSize(11).text(`${CONFIG.concept} ${invoice.month}`, 50, 295, { width: 240 });
    doc.text(eur(invoice.subtotal), 310, 295, { width: 100, align: 'right' });
    doc.text(eur(invoice.iva), 420, 295, { width: 60, align: 'right' });
    doc.text(eur(invoice.total), 500, 295, { width: 60, align: 'right' });

    doc.moveTo(310, 345).lineTo(560, 345).stroke();
    doc.fontSize(12).text('Base imponible:', 350, 365, { width: 110, align: 'right' });
    doc.text(eur(invoice.subtotal), 470, 365, { width: 90, align: 'right' });
    doc.text('IVA 21%:', 350, 385, { width: 110, align: 'right' });
    doc.text(eur(invoice.iva), 470, 385, { width: 90, align: 'right' });
    doc.fontSize(14).text('TOTAL:', 350, 415, { width: 110, align: 'right' });
    doc.text(eur(invoice.total), 470, 415, { width: 90, align: 'right' });

    doc.moveDown(8);
    doc.fontSize(9).fillColor('gray').text('Factura generada automáticamente para el historial del Cajón de Facturas.', 50, 720, { align: 'center' });

    doc.end();
    out.on('finish', resolve);
    out.on('error', reject);
  });
}

async function main() {
  const args = parseArgs();
  const today = args.to ? new Date(`${args.to}T00:00:00Z`) : new Date();
  const start = args.from ? new Date(`${args.from}T00:00:00Z`) : firstOfMonth(today);
  const end = firstOfMonth(today);

  fs.mkdirSync(CONFIG.uploadDir, { recursive: true });

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const iva = Number((CONFIG.subtotal * CONFIG.ivaRate).toFixed(2));
  const total = Number((CONFIG.subtotal + iva).toFixed(2));
  const created = [];
  const skipped = [];

  try {
    for (let d = firstOfMonth(start); d <= end; d = addMonth(d)) {
      const date = fmtDate(d);
      const month = fmtMonth(d);
      const reference = `ALQ-${month}`;
      const existing = await pool.query('SELECT id FROM invoices WHERE user_id = $1 AND reference = $2', [CONFIG.userId, reference]);
      if (existing.rows.length) {
        skipped.push({ reference, id: existing.rows[0].id });
        continue;
      }

      const pdfName = `factura_${reference}.pdf`;
      const relativePath = `uploads/${CONFIG.userId}/${pdfName}`;
      const absolutePath = path.join(CONFIG.uploadDir, pdfName);
      const invoice = { reference, date, month, subtotal: CONFIG.subtotal, iva, total };
      await drawInvoicePdf(absolutePath, invoice);

      const raw = {
        generado_automaticamente: true,
        tipo: 'alquiler',
        emisor: CONFIG.issuer,
        cliente: CONFIG.customer,
        concepto: CONFIG.concept,
        mes: month,
        iva_porcentaje: 21
      };

      const res = await pool.query(`
        INSERT INTO invoices (
          user_id, emisor, invoice_date, reference, subtotal, iva, r_eq, total_taxes, total,
          ingestion_channel, raw_ai_response, file_path, actividad, is_other_expense
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING id, reference, invoice_date, total, file_path;
      `, [
        CONFIG.userId, CONFIG.issuer, date, reference, CONFIG.subtotal, iva, 0, iva, total,
        'web', raw, relativePath, null, false
      ]);
      created.push(res.rows[0]);
    }
  } finally {
    await pool.end();
  }

  console.log(JSON.stringify({ created, skipped }, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
