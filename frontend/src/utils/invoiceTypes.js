export const INVOICE_TYPES = [
    { value: 'expense', label: 'CS - Compra Stock', kind: 'expense' },
    { value: 'income', label: 'IF - Ingreso Factura', kind: 'income' },
    { value: 'other_expense', label: 'GR - Gasto Real', kind: 'expense' },
    { value: 'labor_expense', label: 'GRL - Gasto Real Laboral', kind: 'expense' },
    { value: 'other_income', label: 'IO - Ingresos Otros', kind: 'income' }
];

export const getInvoiceType = (value) => (
    INVOICE_TYPES.find(type => type.value === value) || INVOICE_TYPES[0]
);

export const getInvoiceTypeLabel = (value) => getInvoiceType(value).label;

export const isIncomeType = (value) => getInvoiceType(value).kind === 'income';

export const isExpenseType = (value) => getInvoiceType(value).kind === 'expense';

export const isStockPurchaseType = (value) => value === 'expense';

export const isRealExpenseType = (value) => value === 'other_expense' || value === 'labor_expense';
