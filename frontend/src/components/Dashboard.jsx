import { useState, useEffect, useMemo } from 'react';
import SmartCard from './SmartCard';
import InvoiceTable from './InvoiceTable';

export default function Dashboard({ apiBase, user }) {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estados de filtrado
    const [filterTerm, setFilterTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reqFilter, setReqFilter] = useState('all'); // 'all', 'with', 'without'

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const [invRes] = await Promise.all([
                    fetch(`${apiBase}/invoices`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);
                const invData = await invRes.json();
                setInvoices(invData);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [apiBase]);

    // Lógica de filtrado combinada
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const matchesTerm = inv.emisor?.toLowerCase().includes(filterTerm.toLowerCase());

            // Normalizar fechas para comparación inclusive (solo YYYY-MM-DD) usando componentes locales para evitar desfases de zona horaria
            const d = new Date(inv.invoice_date);
            const invDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const matchesStart = !startDate || invDateStr >= startDate;
            const matchesEnd = !endDate || invDateStr <= endDate;

            const rEqValue = parseFloat(inv.r_eq || 0);
            const matchesReq = reqFilter === 'all' || 
                (reqFilter === 'with' && rEqValue > 0) || 
                (reqFilter === 'without' && rEqValue === 0);

            return matchesTerm && matchesStart && matchesEnd && matchesReq;
        });
    }, [invoices, filterTerm, startDate, endDate, reqFilter]);

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
                    subtext={`${stats.topEmisor?.total.toFixed(2) || 0}€ gastados`}
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
                reqFilter={reqFilter}
                setReqFilter={setReqFilter}
            />
        </div>
    );
}

