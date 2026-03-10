import React from 'react';
import { Link } from 'react-router-dom';
import {
    FileText,
    ArrowRight,
    MessageSquare,
    Mail,
    Zap,
} from 'lucide-react';

const LandingPage = () => {
    return (
        <div className="landing-page min-h-screen">
            {/* Navbar */}
            <nav className="nav-blur py-4">
                <div className="container flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                            <FileText size={22} color="#fff" />
                        </div>
                        <span className="text-xl font-bold tracking-tighter">Cajón AI</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <Link to="/auth?mode=login" className="text-sm text-muted hover:text-white">Log in</Link>
                        <Link to="/auth?mode=signup" className="btn btn-primary">Sign up</Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="pt-40 pb-32">
                <div className="container max-w-5xl">
                    <div className="flex flex-col items-center text-center">
                        <div className="badge-linear">
                            New: Procesamiento con IA multimodal <ArrowRight size={12} className="ml-1" />
                        </div>
                        <h1 className="hero-title hero-gradient">
                            Archivación de facturas <br /> en un cajón inteligente. <br />
                        </h1>
                        <p className="hero-subtitle mt-16 mb-12 mx-auto">
                            Diseñado para la era de la IA. <br />
                            Gestiona tus facturas desde Telegram o Email con una precisión sin precedentes.
                        </p>
                        <div className="flex gap-4">
                            <Link to="/auth?mode=signup" className="btn btn-primary px-8">
                                Empezar ahora
                            </Link>
                        </div>
                    </div>

                    {/* Large Mockup Element */}
                    <div className="mt-24 relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-2xl opacity-20"></div>
                        <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden aspect-video flex items-center justify-center">
                            <img
                                src="/workflow.png"
                                alt="Flujo de Trabajo Cajón AI"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </main>

            {/* Grid Features */}
            <section id="features" className="py-24 border-t border-slate-100 bg-slate-50">
                <div className="container max-w-7xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 text-center md:text-left">
                        <div className="space-y-4 flex flex-col items-center md:items-start p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 flex items-center justify-center bg-indigo-50 rounded-xl mb-2">
                                <MessageSquare size={24} className="text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-semibold">Vía Telegram</h3>
                            <p className="text-sm text-muted">
                                Envía tus facturas como fotos o PDFs directamente a nuestro bot oficial.
                                Se procesarán en tiempo real.
                            </p>
                        </div>
                        <div className="space-y-4 flex flex-col items-center md:items-start p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 flex items-center justify-center bg-indigo-50 rounded-xl mb-2">
                                <Mail size={24} className="text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-semibold">Integración de Email</h3>
                            <p className="text-sm text-muted">
                                Reenvía tus facturas por correo electrónico. Nuestra IA detectará al emisor e
                                impuestos automáticamente.
                            </p>
                        </div>
                        <div className="space-y-4 flex flex-col items-center md:items-start p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 flex items-center justify-center bg-indigo-50 rounded-xl mb-2">
                                <Zap size={24} className="text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-semibold">Gestión con IA</h3>
                            <p className="text-sm text-muted">
                                Extracción automática de datos fiscales: Base Imponible, IVA, Retenciones (R.EQ) y Totales.
                            </p>
                        </div>
                        <div className="space-y-4 flex flex-col items-center md:items-start p-8 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 flex items-center justify-center bg-indigo-50 rounded-xl mb-2">
                                <ArrowRight size={24} className="text-indigo-600" />
                            </div>
                            <h3 className="text-lg font-semibold">Organización de datos</h3>
                            <p className="text-sm text-muted">
                                Filtrado y exportación de facturas para otros sistemas.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 border-t border-slate-100 bg-white">
                <div className="container flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2 opacity-50">
                        <FileText size={16} className="text-indigo-600" />
                        <span className="text-sm font-semibold text-slate-900">Cajón AI</span>
                    </div>
                    <div className="flex gap-8 text-xs text-muted">
                        <a href="#" className="hover:text-indigo-600 transition-colors">Twitter</a>
                        <a href="#" className="hover:text-indigo-600 transition-colors">GitHub</a>
                        <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
                    </div>
                    <p className="text-xs text-muted">
                        &copy; 2026 Cajón AI, Inc.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
