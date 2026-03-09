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
                        <span className="text-xl font-bold tracking-tighter">Linear Invoices</span>
                    </div>
                    <div className="hidden md:flex gap-8 text-sm text-muted">
                        <a href="#features" className="hover:text-white transition-colors">Características</a>
                        <a href="#workflow" className="hover:text-white transition-colors">Flujo</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Precios</a>
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
                            New: Procesamiento con Gemini 1.5 Flash <ArrowRight size={12} className="ml-1" />
                        </div>
                        <h1 className="hero-title hero-gradient">
                            El sistema de facturación <br /> para equipos productivos
                        </h1>
                        <p className="hero-subtitle mb-12 mx-auto">
                            Diseñado para la era de la IA. Gestiona tus facturas desde Telegram o Email
                            con una precisión sin precedentes. Sin fricción, sin esfuerzo.
                        </p>
                        <div className="flex gap-4">
                            <Link to="/auth?mode=signup" className="btn btn-primary px-8">
                                Empezar ahora
                            </Link>
                            <button className="btn btn-secondary px-8">
                                Ver demo
                            </button>
                        </div>
                    </div>

                    {/* Large Mockup Element */}
                    <div className="mt-24 relative">
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-3xl blur-2xl opacity-10"></div>
                        <div className="relative bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden aspect-video">
                            <div className="h-10 bg-slate-50 flex items-center px-4 gap-2 border-b border-slate-100">
                                <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                                <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                                <div className="w-3 h-3 rounded-full bg-slate-200"></div>
                            </div>
                            <div className="p-8 grid grid-cols-4 gap-8">
                                <div className="col-span-1 space-y-4">
                                    {[1, 2, 3, 4].map(i => (
                                        <div key={i} className="h-6 bg-slate-100 rounded w-full"></div>
                                    ))}
                                </div>
                                <div className="col-span-3 space-y-6">
                                    <div className="h-12 bg-slate-100 rounded w-1/3"></div>
                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="h-32 bg-slate-100 rounded"></div>
                                        <div className="h-32 bg-slate-100 rounded"></div>
                                        <div className="h-32 bg-slate-100 rounded"></div>
                                    </div>
                                    <div className="h-48 bg-slate-100 rounded w-full"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Grid Features */}
            <section id="features" className="py-24 border-t border-slate-100 bg-slate-50">
                <div className="container max-w-6xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
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
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-20 border-t border-slate-100 bg-white">
                <div className="container flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex items-center gap-2 opacity-50">
                        <FileText size={16} className="text-indigo-600" />
                        <span className="text-sm font-semibold text-slate-900">Linear Invoices</span>
                    </div>
                    <div className="flex gap-8 text-xs text-muted">
                        <a href="#" className="hover:text-indigo-600 transition-colors">Twitter</a>
                        <a href="#" className="hover:text-indigo-600 transition-colors">GitHub</a>
                        <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
                    </div>
                    <p className="text-xs text-muted">
                        &copy; 2026 Linear Invoices, Inc.
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
