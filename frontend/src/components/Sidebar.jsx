import React from 'react';
import {
    FileText,
    LayoutDashboard,
    User,
    LogOut,
    Settings,
    Plus
} from 'lucide-react';

const Sidebar = ({ activeTab, onTabChange, onLogout, user }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'upload', label: 'Subir Facturas', icon: Plus },
        { id: 'profile', label: 'Perfil', icon: User },
        { id: 'settings', label: 'Ajustes', icon: Settings },
    ];

    return (
        <aside className="sidebar">
            <div className="flex items-center gap-3 mb-10 px-2">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
                    <FileText size={20} color="#fff" />
                </div>
                <span className="font-bold tracking-tighter text-xl text-slate-900">Cajón IA</span>
            </div>

            <div className="flex-1 space-y-1">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`}
                    >
                        <item.icon size={18} />
                        <span className="font-medium">{item.label}</span>
                    </button>
                ))}
            </div>

            <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
                <div className="px-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10"></div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-medium truncate">{user?.name || 'Usuario'}</span>
                        <span className="text-[10px] text-muted truncate">{user?.email}</span>
                    </div>
                </div>

                <button
                    onClick={onLogout}
                    className="sidebar-link text-red-400 hover:text-red-300 hover:bg-red-500/5"
                >
                    <LogOut size={18} />
                    <span>Cerrar sesión</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
