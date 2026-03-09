import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { API_BASE } from '../config';

const Auth = ({ onLogin }) => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const mode = searchParams.get('mode') || 'login';

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');


    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Algo salió mal');

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            onLogin(data.user);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
            <Link to="/" className="fixed top-8 left-8 text-muted hover:text-indigo-600 flex items-center gap-2 text-sm transition-colors">
                <ArrowLeft size={16} />
                Volver
            </Link>

            <div className="auth-card">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-indigo-100">
                        <FileText size={28} color="#fff" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {mode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                    </h1>
                    <p className="text-muted text-sm mt-2 text-center">
                        {mode === 'login'
                            ? 'Introduce tus credenciales para acceder'
                            : 'Empieza a gestionar tus facturas con IA'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded text-red-500 text-xs text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'signup' && (
                        <div>
                            <label className="text-xs font-medium text-muted mb-1.5 block">Nombre</label>
                            <input
                                type="text"
                                className="input-minimal"
                                placeholder="Tu nombre completo"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-medium text-muted mb-1.5 block">Email</label>
                        <input
                            type="email"
                            className="input-minimal"
                            placeholder="nombre@ejemplo.com"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>

                    <div>
                        <label className="text-xs font-medium text-muted mb-1.5 block">Contraseña</label>
                        <input
                            type="password"
                            className="input-minimal"
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-primary w-full justify-center h-11 mt-4"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : (mode === 'login' ? 'Entrar' : 'Registrarse')}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-slate-100">
                    <p className="text-sm text-muted">
                        {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                        <Link
                            to={`/auth?mode=${mode === 'login' ? 'signup' : 'login'}`}
                            className="text-indigo-600 font-semibold ml-1 hover:underline underline-offset-4"
                        >
                            {mode === 'login' ? 'Crear una' : 'Iniciar sesión'}
                        </Link>
                    </p>
                </div>
            </div>

            <p className="fixed bottom-8 text-[10px] text-muted/30 max-w-xs text-center">
                Al continuar, aceptas nuestras Condiciones de servicio y nuestra Política de privacidad.
            </p>
        </div>
    );
};

export default Auth;
