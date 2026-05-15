import { useState, useEffect, Fragment } from 'react';
import { INVOICE_TYPES, getInvoiceTypeLabel, isIncomeType } from '../utils/invoiceTypes';

export default function InvoiceTable({
    invoices,
    filteredInvoices,
    user,
    filterTerm,
    setFilterTerm,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    otherExpenseFilter,
    setOtherExpenseFilter,
    invoiceTypeFilter,
    setInvoiceTypeFilter,
    activityFilter,
    setActivityFilter,
    apiBase,
    isQuarterFilterActive,
    setIsQuarterFilterActive,
    currentQuarterDates
}) {
    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(20);
    const [activities, setActivities] = useState([]);
    const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

    // Cargar actividades para el filtro
    useEffect(() => {
        const fetchActivities = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${apiBase}/activities`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        setActivities(data.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
                    } else {
                        console.error("Activities data is not an array:", data);
                    }
                } else {
                    console.error("Failed to fetch activities:", res.statusText);
                }
            } catch (err) {
                console.error("Error fetching activities for filter:", err);
            }
        };
        fetchActivities();
    }, [apiBase]);

    // Resetear a la primera página cuando cambian los filtros o el tamaño de página
    useEffect(() => {
        setCurrentPage(1);
    }, [filteredInvoices.length, rowsPerPage]);

    // Cálculo de facturas paginadas
    const totalPages = Math.ceil(filteredInvoices.length / rowsPerPage);
    const paginatedInvoices = filteredInvoices.slice(
        (currentPage - 1) * rowsPerPage,
        currentPage * rowsPerPage
    );

    const startIndex = (currentPage - 1) * rowsPerPage + 1;
    const endIndex = Math.min(currentPage * rowsPerPage, filteredInvoices.length);

    const handleDelete = async (id, emisor) => {
        if (!window.confirm(`¿Estás seguro de que quieres eliminar la factura de "${emisor}"? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiBase}/invoices/${id}`, {
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

        // Cabeceras (siempre incluimos las columnas de impuestos para evitar confusión)
        const headers = ["Tipo", "Emisor", "Fecha", "Actividad", "Exportar IVA", "Nº Factura", "Total", "Subtotal", "IVA", "Recargo Equi.", "Total Impuestos"];
        
        const rows = dataToExport.map(inv => [
            getInvoiceTypeLabel(inv.invoice_type || 'expense'),
            inv.emisor,
            inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : '---',
            inv.actividad || "Sin asignar",
            inv.is_other_expense ? "Sí" : "No",
            inv.reference ? `="${inv.reference}"` : '---',
            inv.total,
            inv.is_other_expense ? (inv.subtotal || 0) : '',
            inv.is_other_expense ? (inv.iva || 0) : '',
            inv.is_other_expense ? (inv.r_eq || 0) : '',
            inv.is_other_expense ? (inv.total_taxes || 0) : ''
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
        setOtherExpenseFilter('all');
        setInvoiceTypeFilter('all');
        setActivityFilter('all');
        setIsQuarterFilterActive(false); // Al limpiar filtros, quitamos el auto-filtro para ver todo
    };

    const hasFilters = filterTerm || startDate || endDate || otherExpenseFilter !== 'all' || invoiceTypeFilter !== 'all' || activityFilter !== 'all';

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

                    <div style={{ flex: '0 0 160px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>TIPO</label>
                        <select
                            className="input-minimal"
                            value={invoiceTypeFilter}
                            onChange={(e) => setInvoiceTypeFilter(e.target.value)}
                            style={{ width: '100%', cursor: 'pointer' }}
                        >
                            <option value="all">Todos</option>
                            {INVOICE_TYPES.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ flex: '0 0 160px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>EXPORTAR IVA</label>
                        <select
                            className="input-minimal"
                            value={otherExpenseFilter}
                            onChange={(e) => setOtherExpenseFilter(e.target.value)}
                            style={{ width: '100%', cursor: 'pointer' }}
                        >
                            <option value="all">Todos</option>
                            <option value="yes">Sí</option>
                            <option value="no">No</option>
                        </select>
                    </div>

                    <div style={{ flex: '1 1 250px', position: 'relative' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>BUSCAR EMISOR</label>
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
                    {/* Toggle Trimestre Actual */}
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
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                marginBottom: '16px'
                            }}
                            title="Filtrar automáticamente por el trimestre actual"
                        >
                            <span style={{ fontSize: '1.1rem' }}>📅</span>
                            <span style={{ whiteSpace: 'nowrap' }}>Trimestre Actual</span>
                            {isQuarterFilterActive && <span style={{ fontSize: '1.2rem', marginLeft: '4px', animation: 'fadeIn 0.3s ease' }}>✓</span>}
                        </button>
                    </div>


                    <div style={{ flex: '1 1 160px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'block' }}>ACTIVIDAD</label>
                        <select
                            className="input-minimal"
                            value={activityFilter}
                            onChange={(e) => setActivityFilter(e.target.value)}
                            style={{ width: '100%', cursor: 'pointer' }}
                        >
                            <option value="all">Todas las actividades</option>
                            {activities.map(act => (
                                <option key={act.id} value={act.name}>{act.name}</option>
                            ))}
                        </select>
                    </div>

                    {hasFilters && (
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
                <table style={{ minWidth: '850px' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '8%', fontSize: '0.65rem', lineHeight: '1.1', textAlign: 'center' }}>Exportar<br/>IVA</th>
                            <th style={{ width: '12%' }}>Tipo</th>
                            <th style={{ width: '18%' }}>Emisor</th>
                            <th style={{ width: '12%' }}>Fecha</th>
                            <th style={{ width: '15%' }}>Actividad</th>
                            <th style={{ width: '15%' }}>Nº Factura</th>
                            <th style={{ width: '12%' }}>Total</th>
                            <th style={{ width: '8%' }}>Canal</th>
                            <th style={{ width: '4%', textAlign: 'center' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedInvoices.length > 0 ? (
                            paginatedInvoices.map((inv) => {
                                const rowStyle = {
                                    background: inv.is_other_expense ? 'var(--bg-expense)' : 'transparent',
                                    transition: 'background 0.3s ease'
                                };

                                const handleToggleOtherExpense = async (e) => {
                                    const newValue = e.target.checked;
                                    try {
                                        const token = localStorage.getItem('token');
                                        const res = await fetch(`${apiBase}/invoices/${inv.id}/other-expense`, {
                                            method: 'PUT',
                                            headers: { 
                                                'Authorization': `Bearer ${token}`,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({ value: newValue })
                                        });
                                        if (res.ok) {
                                            inv.is_other_expense = newValue;
                                            window.location.reload(); 
                                        }
                                    } catch (err) {
                                        console.error("Error updating other expense:", err);
                                    }
                                };

                                const handleActivityChange = async (e) => {
                                    const newActivity = e.target.value;
                                    try {
                                        const token = localStorage.getItem('token');
                                        const res = await fetch(`${apiBase}/invoices/${inv.id}/activity`, {
                                            method: 'PUT',
                                            headers: { 
                                                'Authorization': `Bearer ${token}`,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({ activityName: newActivity })
                                        });
                                        if (res.ok) {
                                            window.location.reload(); 
                                        }
                                    } catch (err) {
                                        console.error("Error updating activity:", err);
                                    }
                                };

                                const handleTypeChange = async (e) => {
                                    const newType = e.target.value;
                                    try {
                                        const token = localStorage.getItem('token');
                                        const res = await fetch(`${apiBase}/invoices/${inv.id}/type`, {
                                            method: 'PUT',
                                            headers: {
                                                'Authorization': `Bearer ${token}`,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({ invoiceType: newType })
                                        });
                                        if (res.ok) {
                                            window.location.reload();
                                        }
                                    } catch (err) {
                                        console.error("Error updating invoice type:", err);
                                    }
                                };

                                const isExpanded = expandedInvoiceId === inv.id;
                                
                                const toggleExpand = () => {
                                    setExpandedInvoiceId(isExpanded ? null : inv.id);
                                };

                                return (
                                    <Fragment key={inv.id}>
                                        <tr style={rowStyle}>
                                            <td style={{ textAlign: 'center' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!inv.is_other_expense}
                                                    onChange={handleToggleOtherExpense}
                                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    value={inv.invoice_type || 'expense'}
                                                    onChange={handleTypeChange}
                                                    style={{
                                                        fontSize: '0.75rem',
                                                        padding: '0.2rem 0.4rem',
                                                        borderRadius: '999px',
                                                        border: '1px solid var(--border)',
                                                        background: isIncomeType(inv.invoice_type || 'expense') ? '#dcfce7' : 'var(--bg-secondary)',
                                                        color: isIncomeType(inv.invoice_type || 'expense') ? '#166534' : 'var(--text-main)',
                                                        cursor: 'pointer',
                                                        width: '100%'
                                                    }}
                                                >
                                                    {INVOICE_TYPES.map(type => (
                                                        <option key={type.value} value={type.value}>{type.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{inv.emisor}</td>
                                            <td style={{ whiteSpace: 'nowrap' }}>{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : '---'}</td>
                                            <td>
                                                <select 
                                                    value={inv.actividad || ''} 
                                                    onChange={handleActivityChange}
                                                    style={{
                                                        fontSize: '0.8rem',
                                                        padding: '0.2rem 0.4rem',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--border)',
                                                        background: 'var(--bg-main)',
                                                        color: 'var(--text-main)',
                                                        cursor: 'pointer',
                                                        width: '100%',
                                                        maxWidth: '150px'
                                                    }}
                                                >
                                                    <option value="">Sin asignar</option>
                                                    {activities.map(act => (
                                                        <option key={act.id} value={act.name}>{act.name}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td><code style={{
                                                background: inv.is_other_expense ?  'var(--bg-expense-badge)' : 'var(--bg-secondary)',
                                                padding: '0.2rem 0.5rem',
                                                borderRadius: '4px',
                                                border: '1px solid var(--border)',
                                                fontSize: '0.8rem'
                                            }}>{inv.reference}</code></td>
                                            <td style={{ fontWeight: 700, color: inv.is_other_expense ?  'var(--text-expense)' : 'var(--primary)' }}>{inv.total}€</td>
                                            <td>
                                                <span style={{
                                                    fontSize: '0.7rem',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '10px',
                                                    background: inv.ingestion_channel === 'telegram' ?  'var(--bg-telegram)' :  'var(--bg-web)',
                                                    color: inv.ingestion_channel === 'telegram' ?  'var(--text-telegram)' :  'var(--text-web)',
                                                    textTransform: 'uppercase',
                                                    fontWeight: 700
                                                }}>
                                                    {inv.ingestion_channel}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <div className="flex gap-3 justify-center items-center">
                                                    <button
                                                        onClick={toggleExpand}
                                                        style={{
                                                            border: 'none',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '4px',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 600,
                                                            color: isExpanded ? 'white' : 'var(--text-muted)',
                                                            background: isExpanded ? 'var(--primary)' : 'var(--bg-secondary)',
                                                            padding: '0.2rem 0.5rem',
                                                            borderRadius: '6px',
                                                            transition: 'all 0.2s',
                                                            cursor: 'pointer'
                                                        }}
                                                        title={isExpanded ? "Ocultar detalles" : "Ver más detalles"}
                                                    >
                                                        <span style={{ 
                                                            display: 'inline-flex', 
                                                            transition: 'transform 0.2s ease', 
                                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' 
                                                        }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="6 9 12 15 18 9"></polyline>
                                                            </svg>
                                                        </span>
                                                        <span className="hidden md:inline">Detalles</span>
                                                    </button>
                                                    
                                                    {inv.file_path && (
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    const token = localStorage.getItem('token');
                                                                    const response = await fetch(`${apiBase}/invoices/download/${inv.id}`, {
                                                                        headers: { 'Authorization': `Bearer ${token}` }
                                                                    });
                                                                    if (!response.ok) throw new Error('Error al descargar');
                                                                    
                                                                    const blob = await response.blob();
                                                                    const url = window.URL.createObjectURL(blob);
                                                                    const a = document.createElement('a');
                                                                    a.href = url;
                                                                    a.download = `${inv.emisor}-${inv.reference || inv.id}.pdf`;
                                                                    document.body.appendChild(a);
                                                                    a.click();
                                                                    a.remove();
                                                                    window.URL.revokeObjectURL(url);
                                                                } catch (err) {
                                                                    alert("No se pudo descargar el archivo.");
                                                                    console.error(err);
                                                                }
                                                            }}
                                                            style={{
                                                                border: 'none',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '4px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 600,
                                                                color: 'var(--primary)',
                                                                background: 'var(--primary-soft)',
                                                                padding: '0.2rem 0.5rem',
                                                                borderRadius: '6px',
                                                                transition: 'all 0.2s',
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Descargar factura original"
                                                        >
                                                            <span>📥</span>
                                                            <span className="hidden md:inline">Descargar</span>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleDelete(inv.id, inv.emisor)}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            fontSize: '1rem',
                                                            opacity: 0.6,
                                                            transition: 'opacity 0.2s',
                                                            padding: '4px'
                                                        }}
                                                        title="Eliminar factura"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr style={{ background: 'var(--bg-secondary)', borderLeft: '4px solid var(--primary)', transition: 'all 0.3s ease' }}>
                                                <td colSpan="9" style={{ padding: '1.5rem 2.5rem' }}>
                                                    <div className="flex flex-wrap gap-8 items-start">
                                                        <div className="flex flex-col gap-1">
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subtotal</span>
                                                            <span style={{ fontSize: '1rem', fontWeight: 700 }}>{inv.subtotal || 0}€</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>IVA</span>
                                                            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>{inv.iva || 0}€</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Recargo Equiv. (R.EQ)</span>
                                                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#8b5cf6' }}>{inv.r_eq || 0}€</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Impuestos</span>
                                                            <span style={{ fontSize: '1rem', fontWeight: 700 }}>{inv.total_taxes || 0}€</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1 ml-auto">
                                                            <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Referencia Completa</span>
                                                            <span style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>{inv.reference || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    {hasFilters ? 'No se encontraron facturas para los filtros aplicados.' : 'Aún no has subido ninguna factura.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Controles de Paginación */}
            {filteredInvoices.length > 0 && (
                <div className="flex justify-between items-center p-4 mt-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)', borderRadius: '0 0 0.75rem 0.75rem' }}>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>Mostrar</span>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => setRowsPerPage(Number(e.target.value))}
                            style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                background: 'white',
                                cursor: 'pointer'
                            }}
                        >
                            <option value={20}>20 filas</option>
                            <option value={50}>50 filas</option>
                            <option value={100}>100 filas</option>
                        </select>
                        <span>Mostrando {startIndex} - {endIndex} de {filteredInvoices.length}</span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            className="btn-secondary"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            style={{ padding: '0.4rem 0.8rem', opacity: currentPage === 1 ? 0.5 : 1 }}
                        >
                            Anterior
                        </button>
                        
                        <div className="flex gap-1">
                            {[...Array(totalPages)].map((_, i) => {
                                const page = i + 1;
                                // Mostrar solo las primeras 3, las últimas 3 y las cercanas a la actual
                                if (
                                    totalPages <= 7 ||
                                    page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                ) {
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            style={{
                                                padding: '0.4rem 0.8rem',
                                                borderRadius: '4px',
                                                background: currentPage === page ? 'var(--primary)' : 'transparent',
                                                color: currentPage === page ? 'white' : 'inherit',
                                                border: '1px solid ' + (currentPage === page ? 'var(--primary)' : 'var(--border)'),
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {page}
                                        </button>
                                    );
                                } else if (
                                    (page === 2 && currentPage > 4) ||
                                    (page === totalPages - 1 && currentPage < totalPages - 3)
                                ) {
                                    return <span key={page} style={{ padding: '0.4rem' }}>...</span>;
                                }
                                return null;
                            })}
                        </div>

                        <button
                            className="btn-secondary"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            style={{ padding: '0.4rem 0.8rem', opacity: currentPage === totalPages ? 0.5 : 1 }}
                        >
                            Siguiente
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
