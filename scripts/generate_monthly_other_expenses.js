#!/usr/bin/env node
'use strict';

require('/home/charly/facturas/backend/node_modules/dotenv').config({ path: '/home/charly/facturas/backend/.env' });
const { Pool } = require('/home/charly/facturas/backend/node_modules/pg');

const CONFIG = {
  userId: 2,
  activityId: 1,
  activityName: 'Actividad 1',
  ingestionChannel: 'web',
  expenses: [
    { issuer: 'Nómina Fernando', slug: 'NOMINA-FERNANDO', total: 2041.70 },
    { issuer: 'Nómina Silvia', slug: 'NOMINA-SILVIA', total: 2574.21 },
    { issuer: 'Seguridad Social Fernando', slug: 'SEGURIDAD-SOCIAL-FERNANDO', total: 984.06 },
    { issuer: 'Autónomos Silvia', slug: 'AUTONOMOS-SILVIA', total: 605.77 },
    { issuer: 'Autónomos Carlos', slug: 'AUTONOMOS-CARLOS', total: 605.77 },
  ],
};

function parseArgs() {
  return Object.fromEntries(process.argv.slice(2).map(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || true];
  }));
}

function dateFromArg(value) {
  return new Date(`${value}T00:00:00Z`);
}

function firstOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

function lastDayOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function fmtDate(date) {
  return date.toISOString().slice(0, 10);
}

function fmtMonth(date) {
  return date.toISOString().slice(0, 7);
}

async function ensureIssuers(client) {
  for (const expense of CONFIG.expenses) {
    await client.query(`
      INSERT INTO user_issuers (user_id, emisor_name, activity_id, invoice_type)
      VALUES ($1, $2, $3, 'labor_expense')
      ON CONFLICT (user_id, emisor_name)
      DO UPDATE SET activity_id = EXCLUDED.activity_id, invoice_type = EXCLUDED.invoice_type;
    `, [CONFIG.userId, expense.issuer, CONFIG.activityId]);
  }
}

async function createForMonth(client, monthDate) {
  const invoiceDate = fmtDate(lastDayOfMonth(monthDate));
  const month = fmtMonth(monthDate);
  const created = [];
  const skipped = [];

  for (const expense of CONFIG.expenses) {
    const total = Number(expense.total.toFixed(2));
    const reference = `OTRO-GASTO-${expense.slug}-${month}`;

    const existing = await client.query(
      'SELECT id FROM invoices WHERE user_id = $1 AND reference = $2',
      [CONFIG.userId, reference]
    );

    if (existing.rows.length) {
      skipped.push({ reference, id: existing.rows[0].id });
      continue;
    }

    const raw = {
      generado_automaticamente: true,
      tipo: 'labor_expense',
      periodicidad: 'mensual',
      emisor: expense.issuer,
      mes: month,
      actividad_id: CONFIG.activityId,
      actividad: CONFIG.activityName,
    };

    const result = await client.query(`
      INSERT INTO invoices (
        user_id, emisor, invoice_date, reference, subtotal, iva, r_eq, total_taxes, total,
        ingestion_channel, raw_ai_response, file_path, actividad, is_other_expense, invoice_type
      ) VALUES ($1,$2,$3,$4,$5,0,0,0,$6,$7,$8,NULL,$9,false,'labor_expense')
      RETURNING id, emisor, invoice_date, reference, total, actividad, invoice_type;
    `, [
      CONFIG.userId,
      expense.issuer,
      invoiceDate,
      reference,
      total,
      total,
      CONFIG.ingestionChannel,
      raw,
      CONFIG.activityName,
    ]);

    created.push(result.rows[0]);
  }

  return { month, created, skipped };
}

async function main() {
  const args = parseArgs();
  const today = args.to ? dateFromArg(args.to) : new Date();
  const start = args.from ? dateFromArg(args.from) : today;
  const startMonth = firstOfMonth(start);
  const endMonth = firstOfMonth(today);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const results = [];

  try {
    await client.query('BEGIN');
    await ensureIssuers(client);
    for (let d = startMonth; d <= endMonth; d = addMonth(d)) {
      results.push(await createForMonth(client, d));
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  console.log(JSON.stringify({ results }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
