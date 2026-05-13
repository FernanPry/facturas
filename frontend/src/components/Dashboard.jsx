import { useState, useEffect, useMemo } from 'react';
import SmartCard from './SmartCard';
import InvoiceTable from './InvoiceTable';

export default function Dashboard({ apiBase, user }) {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Estados de filtrado
    const [filterTerm, setFilterTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [otherExpenseFilter, setOtherExpenseFilter] = useState('all'); // 'all', 'yes', 'no'
    const [invoiceTypeFilter, setInvoiceTypeFilter] = useState('all'); // 'all', 'expense', 'income'
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

                const [invRes] = await Promise.all([
                    fetch(`${apiBase}/invoices`, {
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

    // Estadísticas calculadas dinámicamente
    const stats = useMemo(() => {
        const summary = filteredInvoices.reduce((acc, inv) => {
            const type = inv.invoice_type || 'expense';
            const total = parseFloat(inv.total || 0);
            const iva = parseFloat(inv.iva || 0);
            const req = parseFloat(inv.r_eq || 0);

            if (type === 'income') {
                acc.total_income += total;
                acc.iva_repercutido += iva;
                acc.income_count += 1;
            } else {
                acc.total_expense += total;
                acc.iva_soportado += iva;
                acc.total_req += req;
                acc.expense_count += 1;
            }
            acc.invoice_count += 1;
            return acc;
        }, { total_income: 0, total_expense: 0, iva_soportado: 0, iva_repercutido: 0, total_req: 0, income_count: 0, expense_count: 0, invoice_count: 0 });

        // Cálculo de Top Emisor de gasto
        const emisorMap = filteredInvoices
            .filter(inv => (inv.invoice_type || 'expense') === 'expense')
            .reduce((acc, inv) => {
                acc[inv.emisor] = (acc[inv.emisor] || 0) + parseFloat(inv.total || 0);
                return acc;
            }, {});

        const topEmisor = Object.entries(emisorMap)
            .map(([emisor, total]) => ({ emisor, total }))
            .sort((a, b) => b.total - a.total)[0];

        const net = summary.total_income - summary.total_expense;

        return {
            summary: {
                ...summary,
                total_income: summary.total_income.toFixed(2),
                total_expense: summary.total_expense.toFixed(2),
                iva_soportado: summary.iva_soportado.toFixed(2),
                iva_repercutido: summary.iva_repercutido.toFixed(2),
                total_req: summary.total_req.toFixed(2),
                net: net.toFixed(2)
            },
            topEmisor
        };
    }, [filteredInvoices]);

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
                    subtext={`${stats.summary.income_count} facturas emitidas`}
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
                    subtext={`Rep. ${stats.summary.iva_repercutido}€ / Sop. ${stats.summary.iva_soportado}€`}
                    icon="🏛️"
                    color="var(--primary)"
                />
                <SmartCard
                    title="Resultado aprox."
                    value={`${stats.summary.net}€`}
                    subtext={`R.EQ gastos: ${stats.summary.total_req}€`}
                    icon="⚖️"
                    color="#8b5cf6"
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

