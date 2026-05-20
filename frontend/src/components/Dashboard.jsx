import { useState, useEffect, useMemo } from 'react';
import SmartCard from './SmartCard';
import InvoiceTable from './InvoiceTable';
import { isIncomeType } from '../utils/invoiceTypes';

const STOCK_INICIAL_2026 = 78717.37;

export default function Dashboard({ apiBase, user }) {
    const [invoices, setInvoices] = useState([]);
    const [cashHistory, setCashHistory] = useState([]);
    const [stockSummary, setStockSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados de filtrado
    const [filterTerm, setFilterTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [otherExpenseFilter, setOtherExpenseFilter] = useState('all'); // 'all', 'yes', 'no'
    const [invoiceTypeFilter, setInvoiceTypeFilter] = useState('all'); // 'all', 'expense', 'income', 'other_expense', 'other_income'
    const [activityFilter, setActivityFilter] = useState('all'); // 'all' or activity name
    const [isQuarterFilterActive, setIsQuarterFilterActive] = useState(true);

    // Utilidad para obtener fechas del trimestre actual
    const currentQuarterDates = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const quarter = Math.floor(month / 3);
        const startMonth = quarter * 3;
        const endMonth = startMonth + 2;

        const start = new Date(year, startMonth, 1);
        const end = new Date(year, endMonth + 1, 0);

        const formatDate = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        return {
            start: formatDate(start),
            end: formatDate(end)
        };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) throw new Error("No hay sesión activa");

                const [invRes, cashRes, stockRes] = await Promise.all([
                    fetch(`${apiBase}/invoices`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${apiBase}/cash-history`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${apiBase}/stock-summary`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                if (!invRes.ok) {
                    if (invRes.status === 401) throw new Error("Sesión expirada");
                    throw new Error("Error al obtener las facturas");
                }

                const invData = await invRes.json();
                if (Array.isArray(invData)) {
                    setInvoices(invData);
                } else {
                    console.error("Data is not an array:", invData);
                    setInvoices([]);
                }

                if (cashRes.ok) {
                    const cashData = await cashRes.json();
                    setCashHistory(Array.isArray(cashData) ? cashData : []);
                } else {
                    console.error("Failed to fetch cash history:", cashRes.statusText);
                    setCashHistory([]);
                }

                if (stockRes.ok) {
                    const stockData = await stockRes.json();
                    setStockSummary(stockData);
                } else {
                    console.error("Failed to fetch stock summary:", stockRes.statusText);
                    setStockSummary(null);
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
                setError(error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [apiBase]);

    // Lógica de filtrado combinada
    const filteredInvoices = useMemo(() => {
        const effectiveStartDate = isQuarterFilterActive ? currentQuarterDates.start : startDate;
        const effectiveEndDate = isQuarterFilterActive ? currentQuarterDates.end : endDate;

        return invoices.filter(inv => {
            const matchesTerm = (inv.emisor || '').toLowerCase().includes((filterTerm || '').toLowerCase());

            // Normalizar fechas para comparación inclusive (solo YYYY-MM-DD)
            let matchesStart = true;
            let matchesEnd = true;
            
            if (inv.invoice_date) {
                const d = new Date(inv.invoice_date);
                if (!isNaN(d.getTime())) {
                    const invDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    matchesStart = !effectiveStartDate || invDateStr >= effectiveStartDate;
                    matchesEnd = !effectiveEndDate || invDateStr <= effectiveEndDate;
                }
            }

            const matchesOtherExpense = otherExpenseFilter === 'all' ||
                (otherExpenseFilter === 'yes' && inv.is_other_expense) ||
                (otherExpenseFilter === 'no' && !inv.is_other_expense);

            const matchesActivity = activityFilter === 'all' || inv.actividad === activityFilter;
            const matchesInvoiceType = invoiceTypeFilter === 'all' || (inv.invoice_type || 'expense') === invoiceTypeFilter;

            return matchesTerm && matchesStart && matchesEnd && matchesOtherExpense && matchesActivity && matchesInvoiceType;
        });
    }, [invoices, filterTerm, startDate, endDate, otherExpenseFilter, invoiceTypeFilter, activityFilter, isQuarterFilterActive, currentQuarterDates]);

    const filteredCashHistory = useMemo(() => {
        const effectiveStartDate = isQuarterFilterActive ? currentQuarterDates.start : startDate;
        const effectiveEndDate = isQuarterFilterActive ? currentQuarterDates.end : endDate;
        const includeCashHistory = !filterTerm.trim()
            && activityFilter === 'all'
            && otherExpenseFilter === 'all'
            && ['all', 'income'].includes(invoiceTypeFilter);

        if (!includeCashHistory) return [];

        return cashHistory.filter((record) => {
            const matchesStart = !effectiveStartDate || record.fecha >= effectiveStartDate;
            const matchesEnd = !effectiveEndDate || record.fecha <= effectiveEndDate;
            return matchesStart && matchesEnd;
        });
    }, [cashHistory, startDate, endDate, filterTerm, otherExpenseFilter, invoiceTypeFilter, activityFilter, isQuarterFilterActive, currentQuarterDates]);

    // Estadísticas calculadas dinámicamente
    const stats = useMemo(() => {
        const cashIncome = filteredCashHistory.reduce((acc, record) => acc + Number(record.importe_ventas_iva_incl_num || 0), 0);
        const cashVatOut = filteredCashHistory.reduce((acc, record) => acc + Number(record.iva_repercutido_num || 0), 0);
        const isLotteryIncome = (inv) => (inv.reference || '').startsWith('LOTERIAS-');
        const isPhoneRechargeCommission = (inv) => (inv.reference || '').startsWith('COMISION-RECARGAS-TELEFONICAS-');
        const isInvoicePaymentCommission = (inv) => (inv.reference || '').startsWith('COMISION-PAGO-FACTURAS-');
        const summary = filteredInvoices.reduce((acc, inv) => {
            const type = inv.invoice_type || 'expense';
            const total = parseFloat(inv.total || 0);
            const iva = parseFloat(inv.iva || 0);
            const req = parseFloat(inv.r_eq || 0);

            if (isIncomeType(type)) {
                acc.total_income += total;
                acc.iva_repercutido += iva;
                acc.income_count += 1;
                if (isLotteryIncome(inv)) acc.lottery_income += total;
                if (isPhoneRechargeCommission(inv)) acc.phone_recharge_commission += total;
                if (isInvoicePaymentCommission(inv)) acc.invoice_payment_commission += total;
            } else {
                acc.total_expense += total;
                acc.iva_soportado += iva;
                acc.total_req += req;
                acc.expense_count += 1;
            }
            acc.invoice_count += 1;
            return acc;
        }, { total_income: 0, total_expense: 0, iva_soportado: 0, iva_repercutido: 0, total_req: 0, lottery_income: 0, phone_recharge_commission: 0, invoice_payment_commission: 0, income_count: 0, expense_count: 0, invoice_count: 0 });

        // Cálculo de Top Emisor de gasto
        const emisorMap = filteredInvoices
            .filter(inv => !isIncomeType(inv.invoice_type || 'expense'))
            .reduce((acc, inv) => {
                acc[inv.emisor] = (acc[inv.emisor] || 0) + parseFloat(inv.total || 0);
                return acc;
            }, {});

        const topEmisor = Object.entries(emisorMap)
            .map(([emisor, total]) => ({ emisor, total }))
            .sort((a, b) => b.total - a.total)[0];

        const invoiceIncome = summary.total_income;
        const otherIncome = invoiceIncome - summary.lottery_income - summary.phone_recharge_commission - summary.invoice_payment_commission;
        const stockTotal = stockSummary?.file ? Number(stockSummary.total_stock_value || 0) : STOCK_INICIAL_2026;
        const incomeInKind = stockTotal - STOCK_INICIAL_2026;
        const totalIncome = invoiceIncome + cashIncome + incomeInKind;
        const net = totalIncome - summary.total_expense;

        return {
            summary: {
                ...summary,
                cash_income: cashIncome.toFixed(2),
                invoice_income: otherIncome.toFixed(2),
                lottery_income: summary.lottery_income.toFixed(2),
                phone_recharge_commission: summary.phone_recharge_commission.toFixed(2),
                invoice_payment_commission: summary.invoice_payment_commission.toFixed(2),
                income_in_kind: incomeInKind.toFixed(2),
                stock_initial: STOCK_INICIAL_2026.toFixed(2),
                total_income: totalIncome.toFixed(2),
                total_expense: summary.total_expense.toFixed(2),
                iva_soportado: summary.iva_soportado.toFixed(2),
                iva_repercutido: (summary.iva_repercutido + cashVatOut).toFixed(2),
                iva_repercutido_facturas: summary.iva_repercutido.toFixed(2),
                iva_repercutido_z_caja: cashVatOut.toFixed(2),
                total_req: summary.total_req.toFixed(2),
                net: net.toFixed(2)
            },
            topEmisor
        };
    }, [filteredInvoices, filteredCashHistory, stockSummary]);

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Cargando datos...</div>;

    if (error) return (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid #fee2e2', background: '#fef2f2' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
            <h3 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Error al cargar el dashboard</h3>
            <p style={{ color: '#b91c1c', marginBottom: '1.5rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reintentar</button>
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-4">
                <SmartCard
                    title="Ingresos"
                    value={`${stats.summary.total_income}€`}
                    subtext={`Z caja: ${stats.summary.cash_income}€ / Otros: ${stats.summary.invoice_income}€ / Loterías: ${stats.summary.lottery_income}€ / Recargas: ${stats.summary.phone_recharge_commission}€ / Pago facturas: ${stats.summary.invoice_payment_commission}€ / Ingreso en especie: ${stats.summary.income_in_kind}€`}
                    icon="📈"
                    color="var(--success)"
                />
                <SmartCard
                    title="Gastos"
                    value={`${stats.summary.total_expense}€`}
                    subtext={`${stats.summary.expense_count} facturas recibidas`}
                    icon="💸"
                    color="var(--danger)"
                />
                <SmartCard
                    title="IVA neto"
                    value={`${(parseFloat(stats.summary.iva_repercutido) - parseFloat(stats.summary.iva_soportado)).toFixed(2)}€`}
                    subtext={`Rep. ${stats.summary.iva_repercutido}€ (Z ${stats.summary.iva_repercutido_z_caja}€) / Sop. ${stats.summary.iva_soportado}€`}
                    icon="🏛️"
                    color="var(--primary)"
                />
                <SmartCard
                    title="Resultado aprox."
                    value={`${stats.summary.net}€`}
                    subtext={`Incluye Z caja + ingresos / R.EQ gastos: ${stats.summary.total_req}€`}
                    icon="⚖️"
                    color="#8b5cf6"
                />
                <SmartCard
                    title="Stock"
                    value={`${Number(stockSummary?.total_stock_value || 0).toFixed(2)}€`}
                    subtext={stockSummary?.file ? `${stockSummary.total_units} uds / ${stockSummary.product_count} productos / Stock inicial: ${stats.summary.stock_initial}€` : `Sin descarga de stock / Stock inicial: ${stats.summary.stock_initial}€`}
                    icon="📦"
                    color="#0f766e"
                />
            </div>

            <InvoiceTable
                invoices={invoices}
                filteredInvoices={filteredInvoices}
                user={user}
                apiBase={apiBase}
                filterTerm={filterTerm}
                setFilterTerm={setFilterTerm}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                otherExpenseFilter={otherExpenseFilter}
                setOtherExpenseFilter={setOtherExpenseFilter}
                invoiceTypeFilter={invoiceTypeFilter}
                setInvoiceTypeFilter={setInvoiceTypeFilter}
                activityFilter={activityFilter}
                setActivityFilter={setActivityFilter}
                isQuarterFilterActive={isQuarterFilterActive}
                setIsQuarterFilterActive={setIsQuarterFilterActive}
                currentQuarterDates={currentQuarterDates}
            />
        </div>
    );
}

