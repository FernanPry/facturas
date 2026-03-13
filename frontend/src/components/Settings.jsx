import { useState } from 'react';

export default function Settings({ user, setUser, apiBase }) {
    const [formData, setFormData] = useState({
        email: user?.email || '',
        password: '',
        confirmPassword: ''
    });
    const [status, setStatus] = useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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
                body: JSON.stringify({
                    ...user, // Mantener campos existentes
                    email: formData.email,
                    password: formData.password
                })
            });
            const updated = await res.json();

            if (res.ok) {
                setUser(updated);
                localStorage.setItem('user', JSON.stringify(updated));
                setStatus('✅ Ajustes actualizados');
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

    return (
        <div style={{ maxWidth: '600px' }}>
            <div className="card">
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: 'var(--primary)' }}>Credenciales de Acceso</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                    Cambia tu correo electrónico de inicio de sesión o actualiza tu contraseña de acceso.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Correo Electrónico de Acceso</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            className="input-minimal"
                            placeholder="Ej: usuario@empresa.com"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
                        <div className="flex flex-col gap-2">
                            <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontWeight: 500 }}>Nueva Contraseña</label>
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

                    <div className="flex flex-wrap gap-4 justify-between items-center mt-4">
                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{status}</span>
                        <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2.5rem' }}>
                            Actualizar Credenciales
                        </button>
                    </div>
                </form>
            </div>

            <div className="card" style={{ marginTop: '1.5rem', borderLeft: '4px solid var(--warning)' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>⚠️ Importante</p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Si cambias tu correo electrónico, deberás usar el nuevo correo la próxima vez que inicies sesión.
                </p>
            </div>
        </div>
    );
}
