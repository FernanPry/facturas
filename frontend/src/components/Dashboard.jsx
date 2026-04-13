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

            return matchesTerm && matchesStart && matchesEnd && matchesOtherExpense && matchesActivity;
        });
    }, [invoices, filterTerm, startDate, endDate, otherExpenseFilter, activityFilter, isQuarterFilterActive, currentQuarterDates]);

    // Estadísticas calculadas dinámicamente
    const stats = useMemo(() => {
        const summary = filteredInvoices.reduce((acc, inv) => {
            acc.total_accumulated += parseFloat(inv.total || 0);
            acc.total_iva += parseFloat(inv.iva || 0);
            acc.total_req += parseFloat(inv.r_eq || 0);
            acc.invoice_count += 1;
            return acc;
        }, { total_accumulated: 0, total_iva: 0, total_req: 0, invoice_count: 0 });

        // Cálculo de Top Emisor
        const emisorMap = filteredInvoices.reduce((acc, inv) => {
            acc[inv.emisor] = (acc[inv.emisor] || 0) + parseFloat(inv.total || 0);
            return acc;
        }, {});

        const topEmisor = Object.entries(emisorMap)
            .map(([emisor, total]) => ({ emisor, total }))
            .sort((a, b) => b.total - a.total)[0];

        return {
            summary: {
                ...summary,
                total_accumulated: summary.total_accumulated.toFixed(2),
                total_iva: summary.total_iva.toFixed(2),
                total_req: summary.total_req.toFixed(2)
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
                    title="Total Acumulado"
                    value={`${stats.summary.total_accumulated}€`}
                    subtext={`De ${stats.summary.invoice_count} facturas`}
                    icon="💰"
                    color="var(--success)"
                />
                <SmartCard
                    title="IVA Acumulado"
                    value={`${stats.summary.total_iva}€`}
                    subtext="Impuestos IVA"
                    icon="🏛️"
                    color="var(--primary)"
                />
                <SmartCard
                    title="R.EQ Acumulado"
                    value={`${stats.summary.total_req}€`}
                    subtext="Recargo de equiv."
                    icon="⚖️"
                    color="#8b5cf6"
                />
                <SmartCard
                    title="Top Emisor"
                    value={stats.topEmisor?.emisor || "N/A"}
                    subtext={`${stats.topEmisor?.total ? stats.topEmisor.total.toFixed(2) : '0.00'}€ gastados`}
                    icon="🏢"
                    color="var(--warning)"
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
                activityFilter={activityFilter}
                setActivityFilter={setActivityFilter}
                isQuarterFilterActive={isQuarterFilterActive}
                setIsQuarterFilterActive={setIsQuarterFilterActive}
                currentQuarterDates={currentQuarterDates}
            />
        </div>
    );
}

