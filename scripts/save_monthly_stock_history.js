#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const downloadsDir = '/home/charly/Descargas';
const oldDir = path.join(downloadsDir, 'antiguos listados');
const stockSummaryPath = '/home/charly/facturas/backend/stock_summary.json';
const outputJson = '/home/charly/facturas/backend/monthly_stock_history.json';
const outputCsv = '/home/charly/facturas/backend/monthly_stock_history.csv';

const parseEuro = (value) => Number(String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/[^0-9,.-]/g, '')
  .replace(/\./g, '')
  .replace(',', '.')) || 0;

const parseCsvLine = (line) => {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') { current += '"'; i += 1; }
    else if (char === '"') inQuotes = !inQuotes;
    else if (char === ';' && !inQuotes) { cells.push(current); current = ''; }
    else current += char;
  }
  cells.push(current);
  return cells;
};

const readCsvStock = (filePath) => {
  const csvLines = fs.readFileSync(filePath, 'latin1').split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(csvLines[0] || '');
  const stockIndex = headers.indexOf('Stock');
  const priceIndex = headers.findIndex(h => String(h).toLowerCase().includes('precio de venta'));
  if (stockIndex < 0) throw new Error(`No encuentro columna Stock en ${filePath}`);
  let totalUnits = 0;
  let productCount = 0;
  let calculatedRetailValue = 0;
  for (const line of csvLines.slice(1)) {
    const cells = parseCsvLine(line);
    const units = parseEuro(cells[stockIndex]);
    const price = priceIndex >= 0 ? parseEuro(cells[priceIndex]) : 0;
    totalUnits += units;
    calculatedRetailValue += units * price;
    productCount += 1;
  }
  return {
    total_units: Number(totalUnits.toFixed(2)),
    product_count: productCount,
    calculated_retail_stock_value: Number(calculatedRetailValue.toFixed(2)),
  };
};

const listFiles = [];
for (const dir of [downloadsDir, oldDir]) {
  if (!fs.existsSync(dir)) continue;
  for (const name of fs.readdirSync(dir)) {
    const m = name.match(/^Listado de productos activos (\d{4})(\d{2})(\d{2})-(\d{4})\.csv$/);
    if (!m) continue;
    listFiles.push({
      name,
      path: path.join(dir, name),
      year: m[1],
      month: m[2],
      day: m[3],
      time: m[4],
      date: `${m[1]}-${m[2]}-${m[3]}`,
      monthKey: `${m[1]}-${m[2]}`,
      sortKey: `${m[1]}${m[2]}${m[3]}${m[4]}`,
    });
  }
}

const latestByMonth = new Map();
for (const file of listFiles) {
  const prev = latestByMonth.get(file.monthKey);
  if (!prev || file.sortKey > prev.sortKey) latestByMonth.set(file.monthKey, file);
}

let currentSummary = null;
if (fs.existsSync(stockSummaryPath)) {
  currentSummary = JSON.parse(fs.readFileSync(stockSummaryPath, 'utf8'));
}

const history = [];
// Known starting value used by the cash drawer configuration.
history.push({
  month: '2026-01',
  snapshot_date: '2026-01-01',
  total_stock_value: 78717.37,
  source: 'known_initial_stock_config',
  note: 'Stock inicial configurado para 1 de enero de 2026; no es cierre de mes.',
});

// Manual official values supplied by Charly/Perykles when there is no saved CSV/screen capture.
const manualOfficialStockValues = [
  {
    month: '2026-01',
    snapshot_date: '2026-01-31',
    total_stock_value: 119329.26,
    source: 'manual_official_value',
    note: 'Valor oficial de stock de enero comunicado por Perykles el 2026-05-27.',
  },
  {
    month: '2026-02',
    snapshot_date: '2026-02-28',
    total_stock_value: 74888.03,
    source: 'manual_official_value',
    note: 'Valor oficial de stock de febrero comunicado por Perykles el 2026-05-27.',
  },
];

history.push(...manualOfficialStockValues);

for (const file of [...latestByMonth.values()].sort((a, b) => a.monthKey.localeCompare(b.monthKey))) {
  const csvStock = readCsvStock(file.path);
  const isCurrentOfficial = currentSummary && currentSummary.file === file.name && Number(currentSummary.total_stock_value) > 0;
  history.push({
    month: file.monthKey,
    snapshot_date: file.date,
    snapshot_time: file.time,
    total_stock_value: isCurrentOfficial ? Number(currentSummary.total_stock_value) : null,
    source: isCurrentOfficial ? 'strator_official_value' : 'csv_available_without_official_value',
    total_units: csvStock.total_units,
    product_count: csvStock.product_count,
    calculated_retail_stock_value: csvStock.calculated_retail_stock_value,
    file: file.path,
    note: isCurrentOfficial
      ? 'Valor oficial leído de Strator y guardado en stock_summary.json.'
      : 'CSV recuperado; Strator no guarda el Valor stock oficial dentro del CSV. Se conserva cálculo orientativo aparte.',
  });
}

// Deduplicate if initial month also has a CSV snapshot; keep both only if dates differ meaningfully.
const cleaned = [];
for (const row of history) {
  if (cleaned.some(x => x.month === row.month && x.snapshot_date === row.snapshot_date && x.source === row.source)) continue;
  cleaned.push(row);
}

fs.writeFileSync(outputJson, JSON.stringify({
  generated_at: new Date().toISOString(),
  policy: 'Último CSV disponible de cada mes. Para valor monetario oficial se usa solo Strator/stock_summary; el cálculo del CSV queda marcado como orientativo.',
  snapshots: cleaned,
}, null, 2));

const headers = ['month','snapshot_date','snapshot_time','total_stock_value','source','total_units','product_count','calculated_retail_stock_value','file','note'];
const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
fs.writeFileSync(outputCsv, [headers.join(';'), ...cleaned.map(row => headers.map(h => esc(row[h])).join(';'))].join('\n') + '\n');

console.log(JSON.stringify({ outputJson, outputCsv, snapshots: cleaned }, null, 2));
