import { useState, useEffect } from 'react';
import SmartCard from './SmartCard';
import InvoiceTable from './InvoiceTable';

export default function Dashboard({ apiBase, user }) {
    const [invoices, setInvoices] = useState([]);
    const [stats, setStats] = useState({ summary: {}, topEmisors: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');
                const [invRes, statsRes] = await Promise.all([
                    fetch(`${apiBase}/invoices`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    fetch(`${apiBase}/stats`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);
                const invData = await invRes.json();
                const statsData = await statsRes.json();

                setInvoices(invData);
                setStats(statsData);
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [apiBase]);

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Cargando datos...</div>;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex gap-4">
                <SmartCard
                    title="Total Acumulado"
                    value={`${stats.summary?.total_accumulated || 0}€`}
                    subtext={`De ${stats.summary?.invoice_count || 0} facturas`}
                    icon="💰"
                    color="var(--success)"
                />
                <SmartCard
                    title="IVA Acumulado"
                    value={`${stats.summary?.total_iva || 0}€`}
                    subtext="Total impuestos recuperables"
                    icon="🏛️"
                    color="var(--primary)"
                />
                <SmartCard
                    title="Top Emisor"
                    value={stats.topEmisors[0]?.emisor || "N/A"}
                    subtext={`${stats.topEmisors[0]?.total || 0}€ gastados`}
                    icon="🏢"
                    color="var(--warning)"
                />
            </div>

            <InvoiceTable invoices={invoices} user={user} />
        </div>
    );
}
