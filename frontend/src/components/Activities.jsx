import React, { useState, useEffect } from 'react';
import { Plus, Save, Briefcase, Building2, Info, CheckCircle2 } from 'lucide-react';

export default function Activities({ apiBase }) {
    const [activities, setActivities] = useState([]);
    const [issuers, setIssuers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null); // ID of activity being saved
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [actRes, issRes] = await Promise.all([
                fetch(`${apiBase}/activities`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${apiBase}/issuers`, { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            const actData = await actRes.json();
            const sortedAct = actData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            const issData = await issRes.json();
            
            setActivities(sortedAct);
            setIssuers(issData);
        } catch (error) {
            console.error("Error fetching activities data:", error);
        } finally {
            setLoading(false);
        }
    };

    const showNotification = (msg) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleAddActivity = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${apiBase}/activities`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const newAct = await res.json();
            setActivities(prev => [...prev, newAct].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            showNotification(`Creada: ${newAct.name}`);
        } catch (error) {
            console.error("Error creating activity:", error);
        }
    };

    const handleUpdateActivity = async (id, name, description) => {
        setSaving(id);
        try {
            const token = localStorage.getItem('token');
            await fetch(`${apiBase}/activities/${id}`, {
                method: 'PUT',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, description })
            });
            showNotification("Actividad actualizada");
        } catch (error) {
            console.error("Error updating activity:", error);
        } finally {
            setSaving(null);
        }
    };

    const handleLinkIssuer = async (emisor_name, activity_id) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`${apiBase}/issuers/link`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ emisor_name, activity_id })
            });
            
            // Actualizar estado local
            setIssuers(issuers.map(iss => 
                iss.name === emisor_name ? { ...iss, activity_id: activity_id ? parseInt(activity_id) : null } : iss
            ));
            showNotification("Vínculo emisor-actividad actualizado");
        } catch (error) {
            console.error("Error linking issuer:", error);
        }
    };

    if (loading) return <div className="text-muted p-8">Cargando configuración...</div>;

    return (
        <div className="flex flex-col gap-8 animate-in fade-in duration-500">
            {notification && (
                <div className="fixed top-6 right-6 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-xl z-50 flex items-center gap-2 animate-in slide-in-from-right">
                    <CheckCircle2 size={18} />
                    {notification}
                </div>
            )}

            {/* SECCIÓN DE ACTIVIDADES */}
            <div className="card">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Briefcase size={20} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">Tus Actividades</h2>
                    </div>
                    <button onClick={handleAddActivity} className="btn btn-primary flex items-center gap-2">
                        <Plus size={18} />
                        Añadir actividad
                    </button>
                </div>

                <div className="grid gap-4">
                    {activities.length > 0 ? activities.map((act) => (
                        <div key={act.id} className="p-4 border rounded-xl bg-slate-50/50 flex flex-col md:flex-row gap-4 items-start md:items-center">
                            <div className="flex-1 w-full">
                                <input 
                                    className="text-lg font-bold bg-transparent border-none focus:ring-0 w-full mb-1 text-slate-800"
                                    value={act.name}
                                    onChange={(e) => setActivities(activities.map(a => a.id === act.id ? {...a, name: e.target.value} : a))}
                                    placeholder="Nombre de la actividad"
                                />
                                <div className="flex items-center gap-2 text-slate-500">
                                    <Info size={14} />
                                    <input 
                                        className="text-sm bg-transparent border-none focus:ring-0 w-full italic"
                                        value={act.description || ''}
                                        onChange={(e) => setActivities(activities.map(a => a.id === act.id ? {...a, description: e.target.value} : a))}
                                        placeholder="Escribe una breve descripción..."
                                    />
                                </div>
                            </div>
                            <button 
                                onClick={() => handleUpdateActivity(act.id, act.name, act.description)}
                                className={`btn ${saving === act.id ? 'opacity-50' : ''}`}
                                style={{ background: 'var(--bg-secondary)', color: 'var(--primary)', border: '1px solid var(--border)' }}
                                disabled={saving === act.id}
                            >
                                <Save size={18} />
                                {saving === act.id ? 'Guardando...' : 'Guardar'}
                            </button>
                        </div>
                    )) : (
                        <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            <p className="text-slate-500">No tienes actividades creadas. Pulsa el botón para empezar.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* SECCIÓN DE EMISORES */}
            <div className="card">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">Relación Emisores-Actividad</h2>
                        <p className="text-sm text-slate-500">Asigna cada emisor a una de tus actividades económicas.</p>
                    </div>
                </div>

                <div className="table-container">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Emisor</th>
                                <th className="text-left py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actividad Asignada</th>
                            </tr>
                        </thead>
                        <tbody>
                            {issuers.map((iss) => (
                                <tr key={iss.name} className="border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="py-4 px-4 font-medium text-slate-700">{iss.name}</td>
                                    <td className="py-4 px-4">
                                        <select 
                                            className="input-minimal w-full md:max-w-xs cursor-pointer"
                                            value={iss.activity_id || ''}
                                            onChange={(e) => handleLinkIssuer(iss.name, e.target.value)}
                                        >
                                            <option value="">Actividad sin asignar</option>
                                            {activities.map(act => (
                                                <option key={act.id} value={act.id}>{act.name}</option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                            {issuers.length === 0 && (
                                <tr>
                                    <td colSpan="2" className="py-12 text-center text-slate-500">
                                        No se han detectado emisores aún. Sube algunas facturas primero.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
