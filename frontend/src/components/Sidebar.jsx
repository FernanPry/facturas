import React from 'react';
import {
    FileText,
    LayoutDashboard,
    User,
    LogOut,
    Settings,
    Plus,
    Briefcase,
    Sun,
    Moon,
    History,
    BarChart3
} from 'lucide-react';

const Sidebar = ({ activeTab, onTabChange, onLogout, user, theme, setTheme }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Historial', icon: History },
        { id: 'upload', label: 'Subir Facturas', icon: Plus },
        { id: 'activities', label: 'Actividades', icon: Briefcase },
        { id: 'finance', label: 'Análisis', icon: BarChart3 },
        { id: 'settings', label: 'Ajustes', icon: Settings },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header flex items-center gap-3 mb-10 px-2">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
                    <FileText size={20} color="#fff" />
                </div>
                <span className="font-bold tracking-tighter text-xl text-slate-900">Cajón IA</span>
            </div>

            <div className="sidebar-nav flex-1 space-y-1">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
                    >
                        <item.icon size={18} />
                        <span className="sidebar-link-text font-medium">{item.label}</span>
                    </button>
                ))}
            </div>

            <div className="sidebar-footer mt-auto pt-6 border-t border-white/5 space-y-4">
                <div className="px-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                            {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium truncate text-main">{user?.name || 'Usuario'}</span>
                            <span className="text-[10px] text-muted truncate">{user?.email}</span>
                        </div>
                    </div>
                    <button 
                        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                        className="p-2 rounded-lg hover:bg-secondary text-muted hover:text-primary transition-colors"
                        title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
                    >
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                </div>

                <button
                    onClick={onLogout}
                    className="sidebar-link text-red-400 hover:text-red-300 hover:bg-red-500/5"
                >
                    <LogOut size={18} />
                    <span className="sidebar-link-text">Cerrar sesión</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
