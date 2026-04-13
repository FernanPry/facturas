import { useState, useEffect } from 'react';

export default function Settings({ user, setUser, apiBase }) {
    const [formData, setFormData] = useState({
        ...user,
        password: '',
        confirmPassword: ''
    });
    const [status, setStatus] = useState('');

    // Sincronizar si el usuario cambia (ej: tras una actualización exitosa)
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                ...user
            }));
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

        if (formData.password && formData.password !== formData.confirmPassword) {
            setStatus('❌ Las contraseñas no coinciden');
            return;
        }

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

            const updated = await res.json();

            if (res.ok) {
                setUser(updated);
                localStorage.setItem('user', JSON.stringify(updated));
                setStatus('✅ Ajustes actualizados con éxito');
                setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
            } else {
                setStatus(`❌ ${updated.error || 'Error al guardar'}`);
            }
            setTimeout(() => setStatus(''), 3000);
        } catch (error) {
            console.error("Error saving settings:", error);
            setStatus('❌ Error de conexión');
        }
    };

    if (!user) return <div style={{ color: 'var(--text-muted)' }}>Cargando ajustes...</div>;

    return (
        <div style={{ maxWidth: '900px' }}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-8">
                
                {/* SECCIÓN 1: DATOS DE FACTURACIÓN */}
                <div className="card">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>🏢</span> Datos de Facturación
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
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

                {/* SECCIÓN 2: CONFIGURACIÓN DE INGESTA */}
                <div className="card">
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📥</span> Canales de Ingesta
                    </h3>
                    <div className="flex flex-col gap-6">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
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
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Vinculación Telegram</label>
                                <div className="flex items-center gap-3" style={{
                                    padding: '0.75rem',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '0.5rem',
                                    border: '1px solid var(--border)',
                                }}>
                                    <span style={{ fontSize: '1.25rem' }}>🤖</span>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0088cc' }}>@cajon_facturas_bot</span>
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    Envía tu contacto al bot para vincular tu cuenta de Telegram.
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            <div className="flex flex-col gap-2">
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Teléfono Vinculado (Obligatorio para Bot)</label>
                                <input
                                    name="phone"
                                    value={formData.phone || ''}
                                    placeholder="+34 600 000 000"
                                    onChange={handleChange}
                                    className="input-minimal"
                                />
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
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ayuda a detectar automáticamente el recargo en tus facturas.</p>
                            </label>
                        </div>
                    </div>
                </div>

                {/* SECCIÓN 3: CREDENCIALES DE ACCESO */}
                <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>🔐</span> Credenciales de Acceso
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Gestiona tu email de acceso y aumenta la seguridad de tu cuenta.
                    </p>

                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Correo Electrónico de Acceso</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email || ''}
                                onChange={handleChange}
                                className="input-minimal"
                                placeholder="Ej: usuario@empresa.com"
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            <div className="flex flex-col gap-2">
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Nueva Contraseña <span style={{fontSize: '0.7rem', opacity: 0.6}}>(Opcional)</span></label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="input-minimal"
                                    placeholder="••••••••"
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Confirmar Contraseña</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="input-minimal"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTÓN GLOBAL DE GUARDAR */}
                <div style={{
                    position: 'sticky',
                    bottom: '1.5rem',
                    background: 'var(--bg-card)',
                    padding: '1.5rem',
                    borderRadius: '1rem',
                    border: '1px solid var(--border)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 10
                }}>
                    <div>
                        <span style={{ 
                            fontSize: '0.95rem', 
                            fontWeight: 600, 
                            color: status.includes('✅') ? 'var(--success)' : status.includes('❌') ? 'var(--danger)' : 'var(--primary)' 
                        }}>
                            {status}
                        </span>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0.8rem 3rem', fontSize: '1rem' }}>
                        Guardar Todos los Cambios
                    </button>
                </div>

            </form>
        </div>
    );
}
