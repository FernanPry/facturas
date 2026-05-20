import React, { useState, useEffect, useMemo } from 'react';
import { isIncomeType } from '../utils/invoiceTypes';
import { 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Receipt, 
    CreditCard, 
    Hash,
    Package,
    Search,
    Calendar,
    ChevronDown
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';

const STOCK_INICIAL_2026 = 78717.37;

const FinanceDashboard = ({ apiBase, user }) => {
    const [invoices, setInvoices] = useState([]);
    const [cashHistory, setCashHistory] = useState([]);
    const [stockSummary, setStockSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filterTerm, setFilterTerm] = useState('');
    const [selectedQuarter, setSelectedQuarter] = useState('all'); // all, Q1, Q2, Q3, Q4
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            const token = localStorage.getItem('token');
            const [invoiceRes, cashRes, stockRes] = await Promise.all([
                fetch(`${apiBase}/invoices`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${apiBase}/cash-history`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                fetch(`${apiBase}/stock-summary`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);
            if (invoiceRes.ok) {
                const data = await invoiceRes.json();
                setInvoices(Array.isArray(data) ? data : []);
            }
            if (cashRes.ok) {
                const data = await cashRes.json();
                setCashHistory(Array.isArray(data) ? data : []);
            }
            if (stockRes.ok) {
                const data = await stockRes.json();
                setStockSummary(data);
            }
        } catch (error) {
            console.error("Error fetching data for dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- LOGICA DE FILTRADO ---
    const filteredInvoices = useMemo(() => {
        return invoices.filter(inv => {
            const date = new Date(inv.invoice_date);
            const month = date.getMonth();
            const year = date.getFullYear();

            // Filtro de Año
            if (year !== selectedYear) return false;

            // Filtro de Trimestre
            if (selectedQuarter !== 'all') {
                const quarter = Math.floor(month / 3) + 1;
                if (`Q${quarter}` !== selectedQuarter) return false;
            }

            // Filtro de Emisor
            if (filterTerm && !inv.emisor?.toLowerCase().includes(filterTerm.toLowerCase())) {
                return false;
            }

            return true;
        });
    }, [invoices, filterTerm, selectedQuarter, selectedYear]);

    const filteredCashHistory = useMemo(() => {
        if (filterTerm.trim()) return [];

        return cashHistory.filter((record) => {
            const date = new Date(`${record.fecha}T00:00:00`);
            const month = date.getMonth();
            const year = date.getFullYear();

            if (year !== selectedYear) return false;

            if (selectedQuarter !== 'all') {
                const quarter = Math.floor(month / 3) + 1;
                if (`Q${quarter}` !== selectedQuarter) return false;
            }

            return true;
        });
    }, [cashHistory, filterTerm, selectedQuarter, selectedYear]);

    // --- PROCESAMIENTO DE DATOS ---

    // 1. KPIs
    const stats = useMemo(() => {
        const cashIncome = filteredCashHistory.reduce((acc, record) => acc + Number(record.importe_ventas_iva_incl_num || 0), 0);
        const cashVatOut = filteredCashHistory.reduce((acc, record) => acc + Number(record.iva_repercutido_num || 0), 0);
        const isLotteryIncome = (inv) => (inv.reference || '').startsWith('LOTERIAS-');
        const isPhoneRechargeCommission = (inv) => (inv.reference || '').startsWith('COMISION-RECARGAS-TELEFONICAS-');
        const isInvoicePaymentCommission = (inv) => (inv.reference || '').startsWith('COMISION-PAGO-FACTURAS-');
        const totals = filteredInvoices.reduce((acc, curr) => {
            const type = curr.invoice_type || 'expense';
            const total = Number(curr.total || 0);
            const iva = Number(curr.iva || 0);
            const req = Number(curr.r_eq || 0);
            if (isIncomeType(type)) {
                acc.income += total;
                acc.vatOut += iva;
                acc.incomeCount += 1;
                if (isLotteryIncome(curr)) acc.lotteryIncome += total;
                if (isPhoneRechargeCommission(curr)) acc.phoneRechargeCommission += total;
                if (isInvoicePaymentCommission(curr)) acc.invoicePaymentCommission += total;
            } else {
                acc.expense += total;
                acc.vatIn += iva;
                acc.req += req;
                acc.expenseCount += 1;
            }
            acc.count += 1;
            return acc;
        }, { income: 0, expense: 0, vatIn: 0, vatOut: 0, req: 0, lotteryIncome: 0, phoneRechargeCommission: 0, invoicePaymentCommission: 0, count: 0, incomeCount: 0, expenseCount: 0 });

        const calcInvoiceNet = (items) => items.reduce((acc, curr) => {
            const sign = isIncomeType(curr.invoice_type || 'expense') ? 1 : -1;
            return acc + sign * Number(curr.total || 0);
        }, 0);

        const cashTotalForMonth = (year, month) => filteredCashHistory
            .filter((record) => {
                const d = new Date(`${record.fecha}T00:00:00`);
                return d.getMonth() === month && d.getFullYear() === year;
            })
            .reduce((acc, record) => acc + Number(record.importe_ventas_iva_incl_num || 0), 0);

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentMonthNet = calcInvoiceNet(filteredInvoices.filter(inv => {
            const d = new Date(inv.invoice_date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })) + cashTotalForMonth(currentYear, currentMonth);

        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const prevMonthNet = calcInvoiceNet(invoices.filter(inv => {
            const d = new Date(inv.invoice_date);
            return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
        })) + cashHistory
            .filter((record) => {
                const d = new Date(`${record.fecha}T00:00:00`);
                return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
            })
            .reduce((acc, record) => acc + Number(record.importe_ventas_iva_incl_num || 0), 0);

        const trend = prevMonthNet === 0 ? 0 : ((currentMonthNet - prevMonthNet) / Math.abs(prevMonthNet)) * 100;
        const stockTotal = stockSummary?.file ? Number(stockSummary.total_stock_value || 0) : STOCK_INICIAL_2026;
        const incomeInKind = stockTotal - STOCK_INICIAL_2026;

        return {
            ...totals,
            invoiceIncome: totals.income - totals.lotteryIncome - totals.phoneRechargeCommission - totals.invoicePaymentCommission,
            lotteryIncome: totals.lotteryIncome,
            phoneRechargeCommission: totals.phoneRechargeCommission,
            invoicePaymentCommission: totals.invoicePaymentCommission,
            cashIncome,
            cashVatOut,
            incomeInKind,
            stockInitial: STOCK_INICIAL_2026,
            stockTotal,
            hasStockSummary: Boolean(stockSummary?.file),
            income: totals.income + cashIncome + incomeInKind,
            net: totals.income + cashIncome + incomeInKind - totals.expense,
            vatOut: totals.vatOut + cashVatOut,
            invoiceVatOut: totals.vatOut,
            vatNet: totals.vatOut + cashVatOut - totals.vatIn,
            trend: trend.toFixed(1),
            isTrendPositive: trend >= 0
        };
    }, [filteredInvoices, filteredCashHistory, invoices, cashHistory, stockSummary]);

    // 2. Gráfico de Área (Resultado Mensual por Actividad)
    const areaData = useMemo(() => {
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const grouped = filteredInvoices.reduce((acc, inv) => {
            const d = new Date(inv.invoice_date);
            const m = d.getMonth();
            const monthName = months[m];
            const activity = inv.actividad || 'Sin Categoría';
            const sign = isIncomeType(inv.invoice_type || 'expense') ? 1 : -1;
            
            if (!acc[monthName]) acc[monthName] = { name: monthName };
            acc[monthName][activity] = (acc[monthName][activity] || 0) + sign * Number(inv.total || 0);
            return acc;
        }, {});

        filteredCashHistory.forEach((record) => {
            const d = new Date(`${record.fecha}T00:00:00`);
            const monthName = months[d.getMonth()];
            if (!grouped[monthName]) grouped[monthName] = { name: monthName };
            grouped[monthName]['Z de caja'] = (grouped[monthName]['Z de caja'] || 0) + Number(record.importe_ventas_iva_incl_num || 0);
        });

        // Asegurar orden cronológico: Enero a la izquierda, meses posteriores a la derecha
        return Object.values(grouped).sort((a, b) => {
            const indexA = months.indexOf(a.name);
            const indexB = months.indexOf(b.name);
            return indexA - indexB; // Ascendente: más antiguo (índice menor) primero
        });
    }, [filteredInvoices, filteredCashHistory]);

    const activities = useMemo(() => {
        const set = new Set();
        filteredInvoices.forEach(inv => set.add(inv.actividad || 'Sin Categoría'));
        if (filteredCashHistory.length > 0) set.add('Z de caja');
        return Array.from(set);
    }, [filteredInvoices, filteredCashHistory]);

    // 3. Top 10 Emisores
    const topIssuers = useMemo(() => {
        const counts = filteredInvoices
            .filter(inv => !isIncomeType(inv.invoice_type || 'expense'))
            .reduce((acc, inv) => {
                const emisor = inv.emisor || 'Desconocido';
                acc[emisor] = (acc[emisor] || 0) + Number(inv.total || 0);
                return acc;
            }, {});

        return Object.entries(counts)
            .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);
    }, [filteredInvoices]);

    // 4. Mix de Canal
    const channelData = useMemo(() => {
        const counts = filteredInvoices.reduce((acc, inv) => {
            const channel = inv.ingestion_channel || 'web';
            acc[channel] = (acc[channel] || 0) + 1;
            return acc;
        }, {});

        return [
            { name: 'Telegram', value: counts.telegram || 0, color: '#0088cc' },
            { name: 'Email', value: counts.email || 0, color: '#4f46e5' },
            { name: 'Web', value: counts.web || 0, color: '#ea4335' },
            { name: 'Z Caja', value: filteredCashHistory.length, color: '#10b981' }
        ].filter(c => c.value > 0);
    }, [filteredInvoices, filteredCashHistory]);

    if (loading) return <div className="p-8 text-center text-slate-400">Cargando análisis BI...</div>;

    const COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#ef4444', '#f59e0b', '#10b981', '#06b6d4'];

    return (
        <div className="flex flex-col gap-6 p-1 animate-in fade-in duration-500">
            
            {/* BARRA DE FILTROS TAILWIND */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar emisor..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
                        value={filterTerm}
                        onChange={(e) => setFilterTerm(e.target.value)}
                    />
                </div>
                
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <select 
                            className="w-full pl-10 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm appearance-none focus:ring-2 focus:ring-indigo-500"
                            value={selectedQuarter}
                            onChange={(e) => setSelectedQuarter(e.target.value)}
                        >
                            <option value="all">Todo el año</option>
                            <option value="Q1">1º Trimestre (Ene-Mar)</option>
                            <option value="Q2">2º Trimestre (Abr-Jun)</option>
                            <option value="Q3">3º Trimestre (Jul-Sep)</option>
                            <option value="Q4">4º Trimestre (Oct-Dic)</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                <div className="flex gap-2">
                     <select 
                        className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                        {[2023, 2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* FILA DE KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard 
                    title="Ingresos" 
                    value={`${stats.income.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`}
                    icon={<DollarSign className="w-5 h-5" />}
                    trend={stats.trend}
                    isPositive={stats.isTrendPositive}
                    color="indigo"
                    label={`Z caja ${stats.cashIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€ / Otros ${stats.invoiceIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€ / Loterías ${stats.lotteryIncome.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€ / Recargas ${stats.phoneRechargeCommission.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€ / Pago facturas ${stats.invoicePaymentCommission.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€ / Ingreso en especie ${stats.incomeInKind.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`}
                />
                <KPICard 
                    title="Gastos" 
                    value={`${stats.expense.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`}
                    icon={<Receipt className="w-5 h-5" />}
                    color="purple"
                    label={`${stats.expenseCount} facturas recibidas`}
                />
                <KPICard 
                    title="IVA neto" 
                    value={`${stats.vatNet.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`}
                    icon={<CreditCard className="w-5 h-5" />}
                    color="rose"
                    label={`Rep. ${stats.vatOut.toFixed(2)}€ (Z ${stats.cashVatOut.toFixed(2)}€) / Sop. ${stats.vatIn.toFixed(2)}€`}
                />
                <KPICard 
                    title="Resultado aprox." 
                    value={`${stats.net.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`}
                    icon={<Hash className="w-5 h-5" />}
                    color="emerald"
                    label={`${stats.count} facturas + ${filteredCashHistory.length} cierres / R.EQ ${stats.req.toFixed(2)}€`}
                />
                <KPICard 
                    title="Stock" 
                    value={`${(stats.hasStockSummary ? stats.stockTotal : 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`}
                    icon={<Package className="w-5 h-5" />}
                    color="teal"
                    label={`${stats.hasStockSummary ? 'Stock actual' : 'Sin descarga de stock'} / Stock inicial ${stats.stockInitial.toLocaleString('es-ES', { minimumFractionDigits: 2 })}€`}
                />
            </div>

            {/* GRÁFICOS - FILA 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* ÁREA APILADA POR ACTIVIDAD */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-bold text-slate-800 dark:text-slate-100">Resultado Mensual por Actividad y Z de caja</h4>
                        <span className="text-xs font-medium px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">Tendencia Temporal</span>
                    </div>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={areaData}>
                                <defs>
                                    {activities.map((act, i) => (
                                        <linearGradient key={`grad-${i}`} id={`color-${i}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0}/>
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#33415522" />
                                <XAxis 
                                    dataKey="name" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#94a3b8', fontSize: 12}}
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fill: '#94a3b8', fontSize: 12}}
                                    tickFormatter={(val) => `${val}€`}
                                />
                                <Tooltip 
                                    contentStyle={{ 
                                        backgroundColor: 'var(--bg-card)', 
                                        borderRadius: '16px', 
                                        border: '1px solid var(--border)',
                                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                                    }}
                                    itemStyle={{ fontSize: '13px' }}
                                />
                                {activities.map((act, i) => (
                                    <Area 
                                        key={act}
                                        type="monotone" 
                                        dataKey={act} 
                                        stackId="1"
                                        stroke={COLORS[i % COLORS.length]} 
                                        fillOpacity={1} 
                                        fill={`url(#color-${i})`} 
                                        strokeWidth={2}
                                    />
                                ))}
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* MIX DE CANAL */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-6">Mix de Ingesta</h4>
                    <div className="flex-1 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={channelData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {channelData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                     contentStyle={{ 
                                        backgroundColor: 'var(--bg-card)', 
                                        borderRadius: '16px', 
                                        border: '1px solid var(--border)',
                                    }}
                                />
                                <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
                        <p className="text-xs text-slate-500 text-center">Telegram supone el {(stats.count + filteredCashHistory.length) ? ((channelData.find(c => c.name === 'Telegram')?.value || 0) / (stats.count + filteredCashHistory.length) * 100).toFixed(0) : 0}% del volumen filtrado.</p>
                    </div>
                </div>

            </div>

            {/* GRÁFICOS - FILA 2 */}
            <div className="grid grid-cols-1 gap-6">
                
                {/* TOP 10 EMISORES */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-8">Top 10 Proveedores por Gasto</h4>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                                layout="vertical" 
                                data={topIssuers}
                                margin={{ left: 40, right: 30 }}
                            >
                                <XAxis type="number" hide />
                                <YAxis 
                                    dataKey="name" 
                                    type="category" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    width={140}
                                    tick={{fill: 'var(--text-main)', fontSize: 13, fontWeight: 500}}
                                />
                                <Tooltip 
                                    cursor={{fill: '#33415511'}}
                                    contentStyle={{ 
                                        backgroundColor: 'var(--bg-card)', 
                                        borderRadius: '12px', 
                                        border: '1px solid var(--border)',
                                    }}
                                    formatter={(value) => [`${value}€`, 'Gasto']}
                                />
                                <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={24}>
                                    {topIssuers.map((entry, index) => (
                                        <Cell 
                                            key={`cell-${index}`} 
                                            fill={index === 0 ? '#4f46e5' : '#4f46e5cc'} 
                                            opacity={1 - (index * 0.08)}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

        </div>
    );
};

// MINI COMPONENTE PARA KPI CARD
const KPICard = ({ title, value, icon, trend, isPositive, color, label }) => {
    const colors = {
        indigo: 'bg-indigo-500',
        purple: 'bg-purple-500',
        rose: 'bg-rose-500',
        emerald: 'bg-emerald-500',
        teal: 'bg-teal-500'
    };
    
    const softColors = {
        indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
        purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
        rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
        emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
        teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400'
    };

    return (
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${softColors[color]}`}>
                    {icon}
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${isPositive ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : 'text-rose-600 bg-rose-50 dark:bg-rose-500/10'}`}>
                        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {trend}%
                    </div>
                )}
            </div>
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">{title}</p>
                <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white leading-none">{value}</h3>
                </div>
                {label && <p className="text-[10px] text-slate-400 mt-2 font-medium">{label}</p>}
            </div>
        </div>
    );
};

export default FinanceDashboard;
