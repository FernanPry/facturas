import { useEffect, useMemo, useState } from 'react';
import SmartCard from './SmartCard';

const formatCurrency = (value) => new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
}).format(Number(value || 0));

const formatDate = (value) => {
    if (!value) return '---';
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('es-ES');
};

export default function CashHistory({ apiBase }) {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [amountFilter, setAmountFilter] = useState('');
    const [isQuarterFilterActive, setIsQuarterFilterActive] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(20);

    const currentQuarterDates = useMemo(() => {
        const now = new Date();
        const year = now.getFullYear();
        const quarter = Math.floor(now.getMonth() / 3);
        const startMonth = quarter * 3;
        const endMonth = startMonth + 2;

        const formatInputDate = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}-${m}-${d}`;
        };

        return {
            start: formatInputDate(new Date(year, startMonth, 1)),
            end: formatInputDate(new Date(year, endMonth + 1, 0))
        };
    }, []);

    useEffect(() => {
        const fetchRecords = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) throw new Error('No hay sesión activa');

                const res = await fetch(`${apiBase}/cash-history`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (!res.ok) {
                    if (res.status === 401) throw new Error('Sesión expirada');
                    throw new Error('Error al obtener el historial de cajas');
                }

                const data = await res.json();
                setRecords(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error('Error fetching cash history:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRecords();
    }, [apiBase]);

    const filteredRecords = useMemo(() => {
        const effectiveStartDate = isQuarterFilterActive ? currentQuarterDates.start : startDate;
        const effectiveEndDate = isQuarterFilterActive ? currentQuarterDates.end : endDate;
        const normalizedAmount = amountFilter.trim().replace(',', '.');

        return records.filter((record) => {
            const matchesStart = !effectiveStartDate || record.fecha >= effectiveStartDate;
            const matchesEnd = !effectiveEndDate || record.fecha <= effectiveEndDate;
            const matchesAmount = !normalizedAmount || String(record.importe_ventas_iva_incl_num).includes(normalizedAmount);

            return matchesStart && matchesEnd && matchesAmount;
        });
    }, [records, startDate, endDate, amountFilter, isQuarterFilterActive, currentQuarterDates]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filteredRecords.length, rowsPerPage]);

    const stats = useMemo(() => {
        const total = filteredRecords.reduce((acc, record) => acc + Number(record.importe_ventas_iva_incl_num || 0), 0);
        const average = filteredRecords.length ? total / filteredRecords.length : 0;
        return { total, average, count: filteredRecords.length };
    }, [filteredRecords]);

    const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);
    const paginatedRecords = filteredRecords.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );
    const startIndex = (currentPage - 1) * rowsPerPage + 1;
    const endIndex = Math.min(currentPage * rowsPerPage, filteredRecords.length);

    const clearFilters = () => {
        setStartDate('');
        setEndDate('');
        setAmountFilter('');
        setIsQuarterFilterActive(false);
    };

    const exportToCSV = () => {
        if (filteredRecords.length === 0) return;
        const headers = ['Fecha', 'Importe ventas IVA incl.'];
        const rows = filteredRecords.map((record) => [
            record.fecha,
            String(record.importe_ventas_iva_incl_num).replace('.', ',')
        ]);
        const csvContent = [headers.join(';'), ...rows.map((row) => row.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `historial_cajas_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const hasFilters = startDate || endDate || amountFilter;

    if (loading) return <div style={{ color: 'var(--text-muted)' }}>Cargando historial de cajas...</div>;

    if (error) return (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', border: '1px solid #fee2e2', background: '#fef2f2' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
            <h3 style={{ color: '#991b1b', marginBottom: '0.5rem' }}>Error al cargar el historial de cajas</h3>
            <p style={{ color: '#b91c1c', marginBottom: '1.5rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Reintentar</button>
        </div>
    );

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-4">
                <SmartCard
                    title="Ventas filtradas"
                    value={formatCurrency(stats.total)}
                    subtext={`${stats.count} cierres de caja`}
                    icon="💶"
                    color="var(--success)"
                />
                <SmartCard
                    title="Media diaria"
                    value={formatCurrency(stats.average)}
                    subtext="Importe ventas IVA incl."
                    icon="📊"
                    color="var(--primary)"
                />
            </div>

            <div className="card" style={{ marginTop: '0.5rem' }}>
                <div className="flex flex-col gap-6 mb-8">
                    <div className="flex justify-between items-center">
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Historial de Cajas</h3>
                        <button className="btn btn-secondary" onClick={exportToCSV} disabled={filteredRecords.length === 0}>
                            📥 Exportar CSV {filteredRecords.length > 0 && `(${filteredRecords.length})`}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-end gap-4 p-4" style={{ background: 'var(--bg-secondary)', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                        <div style={{ flex: '1 1 250px', position: 'relative' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>BUSCAR IMPORTE</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                                <input
                                    type="text"
                                    placeholder="Ejem: 5601,46"
                                    className="input-minimal"
                                    value={amountFilter}
                                    onChange={(e) => setAmountFilter(e.target.value)}
                                    style={{ width: '100%', paddingLeft: '2.5rem' }}
                                />
                            </div>
                        </div>

                        <div style={{ flex: '0 0 160px', opacity: isQuarterFilterActive ? 0.6 : 1, transition: 'opacity 0.3s ease' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>DESDE</label>
                            <input
                                type="date"
                                className="input-minimal"
                                value={isQuarterFilterActive ? currentQuarterDates.start : startDate}
                                onChange={(e) => {
                                    setStartDate(e.target.value);
                                    if (isQuarterFilterActive) setIsQuarterFilterActive(false);
                                }}
                                style={{ width: '100%', cursor: isQuarterFilterActive ? 'not-allowed' : 'text' }}
                                disabled={isQuarterFilterActive}
                            />
                        </div>

                        <div style={{ flex: '0 0 160px', opacity: isQuarterFilterActive ? 0.6 : 1, transition: 'opacity 0.3s ease' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>HASTA</label>
                            <input
                                type="date"
                                className="input-minimal"
                                value={isQuarterFilterActive ? currentQuarterDates.end : endDate}
                                onChange={(e) => {
                                    setEndDate(e.target.value);
                                    if (isQuarterFilterActive) setIsQuarterFilterActive(false);
                                }}
                                style={{ width: '100%', cursor: isQuarterFilterActive ? 'not-allowed' : 'text' }}
                                disabled={isQuarterFilterActive}
                            />
                        </div>

                        <div style={{ flex: '0 0 auto' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>AUTO-FILTRO</label>
                            <button
                                onClick={() => setIsQuarterFilterActive(!isQuarterFilterActive)}
                                className={`btn ${isQuarterFilterActive ? 'btn-primary' : 'btn-secondary'}`}
                                style={{
                                    height: '42px',
                                    padding: '0 1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    borderColor: isQuarterFilterActive ? 'var(--primary)' : 'var(--border)',
                                    background: isQuarterFilterActive ? 'var(--primary)' : 'var(--bg-main)',
                                    color: isQuarterFilterActive ? 'white' : 'var(--text-main)',
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                    marginBottom: '16px'
                                }}
                                title="Filtrar automáticamente por el trimestre actual"
                            >
                                <span style={{ fontSize: '1.1rem' }}>📅</span>
                                <span style={{ whiteSpace: 'nowrap' }}>Trimestre Actual</span>
                                {isQuarterFilterActive && <span style={{ fontSize: '1.2rem', marginLeft: '4px' }}>✓</span>}
                            </button>
                        </div>

                        {(hasFilters || isQuarterFilterActive) && (
                            <button
                                onClick={clearFilters}
                                className="btn btn-secondary"
                                style={{
                                    padding: '0.6rem 1.25rem',
                                    border: '1px solid var(--primary)',
                                    color: 'var(--primary)',
                                    background: 'var(--bg-main)',
                                    height: 'fit-content',
                                    marginBottom: '16px'
                                }}
                            >
                                Quitar filtros
                            </button>
                        )}
                    </div>
                </div>

                <div className="table-container" style={{ padding: '0 0.5rem' }}>
                    <table style={{ minWidth: '650px' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '35%' }}>Fecha</th>
                                <th style={{ width: '35%' }}>Importe ventas IVA incl.</th>
                                <th style={{ width: '30%' }}>Archivo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedRecords.length > 0 ? (
                                paginatedRecords.map((record) => (
                                    <tr key={record.id}>
                                        <td style={{ whiteSpace: 'nowrap', fontWeight: 500 }}>{formatDate(record.fecha)}</td>
                                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(record.importe_ventas_iva_incl_num)}</td>
                                        <td><code style={{ background: 'var(--bg-secondary)', padding: '0.2rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.8rem' }}>{record.archivo}</code></td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="3" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        {(hasFilters || isQuarterFilterActive) ? 'No se encontraron cierres para los filtros aplicados.' : 'No hay cierres de caja registrados.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredRecords.length > 0 && (
                    <div className="flex justify-between items-center p-4 mt-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', borderRadius: '0 0 0.75rem 0.75rem' }}>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Mostrar</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => setRowsPerPage(Number(e.target.value))}
                                style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}
                            >
                                <option value={20}>20 filas</option>
                                <option value={50}>50 filas</option>
                                <option value={100}>100 filas</option>
                            </select>
                            <span>Mostrando {startIndex} - {endIndex} de {filteredRecords.length}</span>
                        </div>

                        <div className="flex gap-2">
                            <button
                                className="btn-secondary"
                                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                disabled={currentPage === 1}
                                style={{ padding: '0.4rem 0.8rem', opacity: currentPage === 1 ? 0.5 : 1 }}
                            >
                                Anterior
                            </button>
                            <button
                                className="btn-secondary"
                                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                disabled={currentPage === totalPages}
                                style={{ padding: '0.4rem 0.8rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
                            >
                                Siguiente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
