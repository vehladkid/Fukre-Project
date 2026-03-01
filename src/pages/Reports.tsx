import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Activity,
    AlertTriangle,
    Clock,
    RefreshCw,
    MapPin,
    TrendingUp,
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { useInfrastructureAnalytics } from '../features/reports/useInfrastructureAnalytics';
import { useInfrastructureHealth } from '../features/health/useInfrastructureHealth';
import AlertsPanel from '../features/health/components/AlertsPanel';

// ─── Chart Skeleton ────────────────────────────────────────────────────────
const ChartSkeleton = ({ height = 250 }: { height?: number }) => (
    <div className={`w-full rounded-xl bg-[#112240]/50 animate-pulse`} style={{ height }} />
);

const Reports = () => {
    const { analytics, loading: analyticsLoading, refreshAnalytics } = useInfrastructureAnalytics();
    const { health, loading: healthLoading, refreshHealth } = useInfrastructureHealth();

    const { zoneDistribution } = analytics;
    const { summary, zoneRisk, alerts } = health;

    const loading = analyticsLoading || healthLoading;

    const handleRefresh = () => {
        refreshAnalytics();
        refreshHealth();
    };

    const scoreColor =
        summary.avg_health_score >= 70 ? 'text-emerald-400' :
            summary.avg_health_score >= 40 ? 'text-amber-400' :
                'text-red-400';

    const scoreBorder =
        summary.avg_health_score >= 70 ? 'border-emerald-500/30' :
            summary.avg_health_score >= 40 ? 'border-amber-500/30' :
                'border-red-500/30';

    const ZONE_RISK_COLORS = {
        LOW: { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
        MEDIUM: { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
        HIGH: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' },
    } as const;

    // Memoize analytics visualization to prevent recomputation on UI re-render
    const barData = useMemo(() => {
        return zoneDistribution.map(z => ({
            name: z.zone_name,
            assets: Number(z.asset_count),
            at_risk: Number(z.at_risk_count),
            safe: Math.max(0, Number(z.asset_count) - Number(z.at_risk_count)),
        }));
    }, [zoneDistribution]);

    // Dynamic height constraint layout rule for the chart
    // Ensures min bar size is preserved no matter how many zones exist.
    const chartHeight = Math.max(280, barData.length * 40);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-white">City Intelligence Reports</h1>
                    <p className="text-slate-400">Deep structural analytics and zone health distributions</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleRefresh}
                        className="flex items-center gap-2 px-4 py-2 bg-[#112240] hover:bg-[#1d3b5a] text-slate-300 rounded-lg text-sm font-medium transition-colors border border-[#233554]"
                    >
                        <RefreshCw size={14} />
                        Refresh Data
                    </button>
                </div>
            </div>

            {/* City Health Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div
                    whileHover={{ y: -4 }}
                    className={`glass-card md:col-span-1 p-6 rounded-2xl border ${scoreBorder} flex flex-col items-center justify-center text-center`}
                >
                    <div className="w-full flex justify-between items-start mb-2">
                        <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">Average City Health Score</p>
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                            <TrendingUp size={12} />
                            Trend
                        </span>
                    </div>
                    <span className={`text-6xl font-black tabular-nums ${scoreColor}`}>
                        {loading ? '–' : summary.avg_health_score}
                    </span>
                    <span className="text-sm text-slate-500 mt-1">/ 100</span>
                    <div className="w-full mt-6 h-2 rounded-full bg-[#233554] overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${summary.avg_health_score >= 70 ? 'bg-emerald-400' :
                                summary.avg_health_score >= 40 ? 'bg-amber-400' : 'bg-red-400'
                                }`}
                            style={{ width: loading ? '0%' : `${summary.avg_health_score}%` }}
                        />
                    </div>
                </motion.div>

                {/* Highlighted Metrics */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[{
                        label: 'Overdue Inspections',
                        value: summary.overdue_count,
                        color: 'text-amber-400',
                        border: 'border-amber-500/20',
                        icon: Clock,
                    }, {
                        label: 'High Risk Assets',
                        value: summary.high_risk_asset_count,
                        color: 'text-red-400',
                        border: 'border-red-500/20',
                        icon: AlertTriangle,
                    }, {
                        label: 'System Alerts',
                        value: summary.alert_count,
                        color: 'text-orange-400',
                        border: 'border-orange-500/20',
                        icon: AlertTriangle,
                    }].map(item => (
                        <motion.div
                            key={item.label}
                            whileHover={{ y: -4 }}
                            className={`glass-card p-6 rounded-2xl border ${item.border} flex flex-col justify-between`}
                        >
                            <item.icon size={22} className={item.color} />
                            <div className="mt-4">
                                <p className={`text-4xl font-bold tabular-nums ${item.color}`}>
                                    {loading ? '–' : item.value}
                                </p>
                                <p className="text-sm text-slate-400 mt-1 font-medium">{item.label}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Assets by Zone (PRIMARY CHART) */}
            <div className="glass-panel p-6 rounded-2xl">
                <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Activity size={18} className="text-teal-400" />
                    Assets by Zone Distribution
                    {(zoneDistribution.some(z => z.at_risk_count > 0)) && (
                        <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                            ⚡ At-risk zones highlighted
                        </span>
                    )}
                </h3>

                {loading ? (
                    <ChartSkeleton height={280} />
                ) : (
                    <div className="analytics-scroll pr-2">
                        <ResponsiveContainer width="100%" height={chartHeight}>
                            <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#233554" horizontal={false} />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={120} />
                                <Tooltip
                                    cursor={{ fill: '#233554', opacity: 0.4 }}
                                    contentStyle={{ backgroundColor: '#112240', borderColor: '#233554', color: '#f1f5f9', borderRadius: '8px' }}
                                />
                                <Bar dataKey="assets" name="Total" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16} />
                                <Bar dataKey="safe" name="Safe / Operational" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
                                <Bar dataKey="at_risk" name="At Risk" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Zone Risk Table + Alerts Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Zone Risk Table */}
                <div className="glass-panel p-6 rounded-2xl">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <MapPin size={18} className="text-teal-400" />
                            Zone Risk Breakdown
                        </h3>
                    </div>
                    <div className="space-y-3">
                        {loading ? (
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="h-14 rounded-xl bg-[#112240]/50 animate-pulse" />
                            ))
                        ) : zoneRisk.map(zone => {
                            const riskCfg = ZONE_RISK_COLORS[zone.zone_risk_level];
                            return (
                                <div key={zone.zone_id} className="flex items-center justify-between p-3 rounded-xl bg-[#112240]/40 border border-[#233554]">
                                    <div className="flex items-center gap-3">
                                        <span className={`block w-2 h-2 rounded-full ${riskCfg.dot}`} />
                                        <div>
                                            <p className="text-sm font-medium text-slate-200">{zone.zone_name}</p>
                                            <p className="text-[10px] text-slate-500">
                                                {zone.total_assets} assets · {zone.overdue_count} overdue · {zone.critical_count} critical
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-slate-400">{zone.avg_health_score}</span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${riskCfg.badge}`}>
                                            {zone.zone_risk_level}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Alerts Panel */}
                <AlertsPanel alerts={alerts} loading={loading} />
            </div>

        </div>
    );
};

export default Reports;
