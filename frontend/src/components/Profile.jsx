import { useState, useEffect } from 'react';

export default function Profile({ user, setUser, apiBase }) {
    const [formData, setFormData] = useState(user || {});
    const [status, setStatus] = useState('');

    // Sincronizar formData cuando el usuario cargue
    useEffect(() => {
        if (user) {
            setFormData(user);
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('Guardando...');
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiBase}/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Error al guardar');
            }
            const updated = await res.json();
            setUser(updated);
            setStatus('✅ Cambios guardados');
            setTimeout(() => setStatus(''), 3000);
        } catch (error) {
            console.error("Error saving profile:", error);
            setStatus('❌ Error al guardar');
        }
    };

    if (!user) return <div style={{ color: 'var(--text-muted)' }}>Cargando perfil...</div>;

    return (
        <div style={{ maxWidth: '800px' }}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                {/* Sección: Datos Personales y de Empresa */}
                <div className="card">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--primary)' }}>Datos de Facturación</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                        <div className="flex flex-col gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Nombre</label>
                            <input
                                name="name"
                                value={formData.name || ''}
                                onChange={handleChange}
                                className="input-minimal"
                                placeholder="Tu nombre"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Apellidos</label>
                            <input
                                name="lastname"
                                value={formData.lastname || ''}
                                onChange={handleChange}
                                className="input-minimal"
                                placeholder="Tus apellidos"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Nombre de la Empresa</label>
                            <input
                                name="company"
                                value={formData.company || ''}
                                onChange={handleChange}
                                className="input-minimal"
                                placeholder="Ejem: Innova S.L."
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Sector Profesional</label>
                            <input
                                name="sector"
                                value={formData.sector || ''}
                                onChange={handleChange}
                                className="input-minimal"
                                placeholder="Ejem: Hostelería, IT..."
                            />
                        </div>
                    </div>
                </div>

                {/* Sección: Canales de Ingesta y Configuración */}
                <div className="card">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--primary)' }}>Configuración de Ingesta</h3>
                    <div className="flex flex-col gap-6">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                            <div className="flex flex-col gap-2">
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Email para Ingesta Directa</label>
                                <div style={{
                                    padding: '0.75rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    color: 'var(--primary)'
                                }}>
                                    vax.grupo@gmail.com
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>* Las facturas enviadas aquí se procesarán automáticamente</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Telegram Bot</label>
                                <div style={{
                                    padding: '0.75rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--border)',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    color: '#0088cc'
                                }}>
                                    @cajon_facturas_bot
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    Vincula tu cuenta enviando tu contacto al bot.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                            <div className="flex flex-col gap-2">
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Teléfono Vinculado</label>
                                <input
                                    name="phone"
                                    value={formData.phone || ''}
                                    placeholder="+34..."
                                    onChange={handleChange}
                                    className="input-minimal"
                                />
                                <p style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>
                                    Necesario para vincular el bot de Telegram.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4" style={{ padding: '1.25rem', background: 'var(--bg-secondary)', borderRadius: '0.75rem', border: '1px solid var(--border)' }}>
                            <input
                                type="checkbox"
                                id="r_eq_checkbox"
                                name="r_eq"
                                checked={formData.r_eq || false}
                                onChange={handleChange}
                                style={{ width: '1.25rem', height: '1.25rem', accentColor: 'var(--primary)' }}
                            />
                            <label htmlFor="r_eq_checkbox" style={{ cursor: 'pointer' }}>
                                <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>Habilitar Recargo de Equivalencia (R.EQ)</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Actívalo si estás en este régimen para detectar automáticamente el recargo en tus facturas.</p>
                            </label>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 justify-between items-center mt-8 pt-6" style={{ borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: status.includes('✅') ? 'var(--primary)' : 'var(--text-main)' }}>{status}</span>
                        <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }}>
                            Guardar Cambios Configuración
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
