export default function InvoiceTable({
    invoices,
    filteredInvoices,
    user,
    filterTerm,
    setFilterTerm,
    startDate,
    setStartDate,
    endDate,
    setEndDate
}) {
    const handleDelete = async (id, emisor) => {
        if (!window.confirm(`¿Estás seguro de que quieres eliminar la factura de "${emisor}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:3001/api/invoices/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                window.location.reload();
            } else {
                alert("Error al eliminar la factura.");
            }
        } catch (error) {
            console.error("Error deleting invoice:", error);
            alert("Error de conexión al eliminar.");
        }
    };

    const exportToCSV = () => {
        const dataToExport = filteredInvoices;
        if (dataToExport.length === 0) return;

        const headers = ["Emisor", "Fecha", "Referencia", "Base", "IVA", "R.EQ", "Total", "Canal"];
        const rows = dataToExport.map(inv => [
            inv.emisor,
            inv.invoice_date,
            inv.reference,
            inv.subtotal,
            inv.iva,
            inv.r_eq,
            inv.total,
            inv.ingestion_channel
        ]);
        const csvContent = [headers.join(";"), ...rows.map(row => row.join(";"))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `facturas_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const clearFilters = () => {
        setFilterTerm('');
        setStartDate('');
        setEndDate('');
    };

    const hasFilters = filterTerm || startDate || endDate;

    return (
        <div className="card" style={{ marginTop: '2rem' }}>
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex justify-between items-center">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Historial de Facturas</h3>
                    <button className="btn btn-secondary" onClick={exportToCSV} disabled={filteredInvoices.length === 0}>
                        📥 Exportar CSV {hasFilters && `(${filteredInvoices.length})`}
                    </button>
                </div>

                <div className="flex flex-wrap items-end gap-4 p-4" style={{ background: 'var(--bg-secondary)', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                    <div style={{ flex: '1 1 250px', position: 'relative' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>BUSCAR EMISOR</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                            <input
                                type="text"
                                placeholder="Ejem: Amazon, Repsol..."
                                className="input-minimal"
                                value={filterTerm}
                                onChange={(e) => setFilterTerm(e.target.value)}
                                style={{ width: '100%', paddingLeft: '2.5rem' }}
                            />
                        </div>
                    </div>

                    <div style={{ flex: '0 0 160px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>DESDE</label>
                        <input
                            type="date"
                            className="input-minimal"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    <div style={{ flex: '0 0 160px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'block' }}>HASTA</label>
                        <input
                            type="date"
                            className="input-minimal"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {hasFilters && (
                        <button
                            onClick={clearFilters}
                            className="btn btn-secondary"
                            style={{
                                padding: '0.6rem 1.25rem',
                                border: '1px solid var(--primary)',
                                color: 'var(--primary)',
                                background: 'transparent',
                                height: 'fit-content'
                            }}
                        >
                            Quitar filtros
                        </button>
                    )}
                </div>
            </div>

            <div className="table-container" style={{ padding: '0 0.5rem' }}>
                <table style={{ minWidth: '850px' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '22%' }}>Emisor</th>
                            <th style={{ width: '12%' }}>Fecha</th>
                            <th style={{ width: '15%' }}>Referencia</th>
                            <th style={{ width: '10%' }}>Base</th>
                            <th style={{ width: '10%' }}>IVA</th>
                            <th style={{ width: '10%' }}>R.EQ</th>
                            <th style={{ width: '10%' }}>Total</th>
                            <th style={{ width: '8%' }}>Canal</th>
                            <th style={{ width: '3%', textAlign: 'center' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredInvoices.length > 0 ? filteredInvoices.map((inv) => {
                            const missingREq = user?.r_eq && (!inv.r_eq || parseFloat(inv.r_eq) <= 0);
                            return (
                                <tr key={inv.id} style={missingREq ? { background: '#fee2e2' } : null}>
                                    <td style={{ fontWeight: 500, whiteSpace: 'nowrap', color: missingREq ? '#991b1b' : 'inherit' }}>{inv.emisor}</td>
                                    <td style={{ whiteSpace: 'nowrap', color: missingREq ? '#991b1b' : 'inherit' }}>{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                    <td><code style={{
                                        background: missingREq ? '#fecaca' : 'var(--bg-secondary)',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '4px',
                                        border: '1px solid ' + (missingREq ? '#f87171' : 'var(--border)'),
                                        fontSize: '0.8rem',
                                        color: missingREq ? '#991b1b' : 'inherit'
                                    }}>{inv.reference}</code></td>
                                    <td style={{ color: missingREq ? '#991b1b' : 'inherit' }}>{inv.subtotal}€</td>
                                    <td style={{ color: missingREq ? '#991b1b' : 'inherit' }}>{inv.iva}€</td>
                                    <td style={{ fontWeight: missingREq ? 700 : 400, color: missingREq ? '#dc2626' : 'inherit' }}>{inv.r_eq}€</td>
                                    <td style={{ fontWeight: 700, color: missingREq ? '#991b1b' : 'var(--primary)' }}>{inv.total}€</td>
                                    <td>
                                        <span style={{
                                            fontSize: '0.7rem',
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '10px',
                                            background: inv.ingestion_channel === 'telegram' ? '#0088cc44' : '#ea433544',
                                            color: inv.ingestion_channel === 'telegram' ? '#0088cc' : '#ea4335',
                                            textTransform: 'uppercase',
                                            fontWeight: 700
                                        }}>
                                            {inv.ingestion_channel}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            onClick={() => handleDelete(inv.id, inv.emisor)}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                cursor: 'pointer',
                                                fontSize: '1rem',
                                                opacity: 0.6,
                                                transition: 'opacity 0.2s'
                                            }}
                                            title="Eliminar factura"
                                            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                            onMouseOut={(e) => e.currentTarget.style.opacity = '0.6'}
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            );
                        }) : (
                            <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    {hasFilters ? 'No se encontraron facturas para los filtros aplicados.' : 'Aún no has subido ninguna factura.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
