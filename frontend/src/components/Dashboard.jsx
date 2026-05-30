import { useState, useEffect, useMemo } from 'react';
import SmartCard from './SmartCard';
import InvoiceTable from './InvoiceTable';
import { isIncomeType, isRealExpenseType, isStockPurchaseType } from '../utils/invoiceTypes';

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
    const [invoiceTypeFilter, setInvoiceTypeFilter] = useState(['all']); // ['all'] o varios: 'expense', 'income', 'other_expense', 'labor_expense', 'other_income'
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

            const selectedInvoiceTypes = Array.isArray(invoiceTypeFilter) ? invoiceTypeFilter : [invoiceTypeFilter];
            const matchesActivity = activityFilter === 'all' || inv.actividad === activityFilter;
            const matchesInvoiceType = selectedInvoiceTypes.includes('all') || selectedInvoiceTypes.includes(inv.invoice_type || 'expense');

            return matchesTerm && matchesStart && matchesEnd && matchesOtherExpense && matchesActivity && matchesInvoiceType;
        });
    }, [invoices, filterTerm, startDate, endDate, otherExpenseFilter, invoiceTypeFilter, activityFilter, isQuarterFilterActive, currentQuarterDates]);

    const filteredCashHistory = useMemo(() => {
        const effectiveStartDate = isQuarterFilterActive ? currentQuarterDates.start : startDate;
        const effectiveEndDate = isQuarterFilterActive ? currentQuarterDates.end : endDate;
        const selectedInvoiceTypes = Array.isArray(invoiceTypeFilter) ? invoiceTypeFilter : [invoiceTypeFilter];
        const includeCashHistory = !filterTerm.trim()
            && activityFilter === 'all'
            && otherExpenseFilter === 'all'
            && (selectedInvoiceTypes.includes('all') || selectedInvoiceTypes.includes('income'));

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
                if (isStockPurchaseType(type)) {
                    acc.stock_purchases += total;
                    acc.stock_purchase_count += 1;
                }
                if (isRealExpenseType(type)) {
                    acc.real_expenses += total;
                    acc.real_expense_count += 1;
                }
            }
            acc.invoice_count += 1;
            return acc;
        }, { total_income: 0, total_expense: 0, stock_purchases: 0, real_expenses: 0, iva_soportado: 0, iva_repercutido: 0, total_req: 0, lottery_income: 0, phone_recharge_commission: 0, invoice_payment_commission: 0, income_count: 0, expense_count: 0, stock_purchase_count: 0, real_expense_count: 0, invoice_count: 0 });

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
                stock_purchases: summary.stock_purchases.toFixed(2),
                real_expenses: summary.real_expenses.toFixed(2),
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
            <div className="dashboard-stats-grid">
                <SmartCard
                    title="Ingresos"
                    value={`${stats.summary.total_income}€`}
                    info="Suma de las entradas del periodo filtrado. Combina ventas registradas en Z de caja, facturas de ingreso y la variación positiva del stock respecto al stock inicial."
                    details={[
                        { label: 'Z de caja', value: `${stats.summary.cash_income}€`, description: 'Ventas con IVA incluido importadas desde los cierres diarios de caja.' },
                        { label: 'Otros ingresos', value: `${stats.summary.invoice_income}€`, description: 'Facturas de ingreso que no pertenecen a loterías, recargas ni pago de facturas.' },
                        { label: 'Loterías', value: `${stats.summary.lottery_income}€`, description: 'Ingresos identificados por referencias de loterías.' },
                        { label: 'Recargas', value: `${stats.summary.phone_recharge_commission}€`, description: 'Comisiones por recargas telefónicas.' },
                        { label: 'Pago facturas', value: `${stats.summary.invoice_payment_commission}€`, description: 'Comisiones por servicios de pago de facturas.' },
                        { label: 'Ingreso en especie', value: `${stats.summary.income_in_kind}€`, description: `Stock actual menos stock inicial (${stats.summary.stock_initial}€).` }
                    ]}
                    icon="📈"
                    color="var(--success)"
                />
                <SmartCard
                    title="Gastos reales"
                    value={`${stats.summary.real_expenses}€`}
                    info="Gastos estructurales del negocio separados de las compras de mercancía. Sirve para ver el coste real operativo sin mezclarlo con reposición de stock."
                    details={[
                        { label: 'Gastos reales', value: `${stats.summary.real_expenses}€`, description: 'Nóminas, autónomos, seguridad social, alquiler, suministros y otros gastos de estructura.' },
                        { label: 'Compras stock', value: `${stats.summary.stock_purchases}€`, description: 'Facturas marcadas como compra de mercancía o reposición de stock.' },
                        { label: 'Total salidas', value: `${stats.summary.total_expense}€`, description: 'Suma de gastos reales más compras de stock del periodo filtrado.' }
                    ]}
                    icon="💸"
                    color="var(--danger)"
                />
                <SmartCard
                    title="IVA neto"
                    value={`${(parseFloat(stats.summary.iva_repercutido) - parseFloat(stats.summary.iva_soportado)).toFixed(2)}€`}
                    info="Estimación de IVA a liquidar: IVA repercutido en ventas e ingresos menos IVA soportado en compras y gastos."
                    details={[
                        { label: 'IVA repercutido', value: `${stats.summary.iva_repercutido}€`, description: 'IVA cobrado al cliente. Incluye facturas de ingreso y Z de caja.' },
                        { label: 'De Z de caja', value: `${stats.summary.iva_repercutido_z_caja}€`, description: 'Parte del IVA repercutido procedente de los cierres de caja.' },
                        { label: 'IVA soportado', value: `${stats.summary.iva_soportado}€`, description: 'IVA pagado en facturas de compras, stock y gastos.' },
                        { label: 'Recargo equivalencia', value: `${stats.summary.total_req}€`, description: 'R.EQ. acumulado en facturas cuando aparece informado.' }
                    ]}
                    icon="🏛️"
                    color="var(--primary)"
                />
                <SmartCard
                    title="Resultado aprox."
                    value={`${stats.summary.net}€`}
                    info="Resultado orientativo del periodo: ingresos totales menos salidas totales. Tiene en cuenta las compras de stock y la variación del stock para aproximar el margen."
                    details={[
                        { label: 'Ingresos totales', value: `${stats.summary.total_income}€`, description: 'Z de caja, otros ingresos, comisiones e ingreso en especie.' },
                        { label: 'Total salidas', value: `${stats.summary.total_expense}€`, description: 'Compras de stock más gastos reales.' },
                        { label: 'Variación stock', value: `${stats.summary.income_in_kind}€`, description: 'Stock actual menos stock inicial; ajusta el resultado al valor de mercancía existente.' },
                        { label: 'R.EQ.', value: `${stats.summary.total_req}€`, description: 'Recargo de equivalencia acumulado, mostrado como referencia fiscal.' }
                    ]}
                    icon="⚖️"
                    color="#8b5cf6"
                />
                <SmartCard
                    title="Stock"
                    value={`${Number(stockSummary?.total_stock_value || STOCK_INICIAL_2026).toFixed(2)}€`}
                    info="Valor oficial del stock importado desde Strator. Si no hay descarga disponible, se muestra como referencia el stock inicial configurado."
                    details={stockSummary?.file ? [
                        { label: 'Unidades', value: `${stockSummary.total_units} uds`, description: 'Suma de unidades existentes en el último listado de stock.' },
                        { label: 'Productos', value: `${stockSummary.product_count}`, description: 'Número de referencias distintas detectadas en el listado.' },
                        { label: 'Stock inicial', value: `${stats.summary.stock_initial}€`, description: 'Valor base usado para calcular la variación de stock.' },
                        { label: 'Variación', value: `${stats.summary.income_in_kind}€`, description: 'Diferencia entre el stock actual y el stock inicial.' }
                    ] : [
                        { label: 'Estado', value: 'Sin descarga', description: 'Todavía no hay un listado de stock disponible para este periodo.' },
                        { label: 'Stock inicial', value: `${stats.summary.stock_initial}€`, description: 'Valor de referencia usado mientras no existe stock descargado.' }
                    ]}
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

