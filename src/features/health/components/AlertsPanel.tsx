import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, MapPin, X, Shield, AlertCircle } from 'lucide-react';
import type { SystemAlert } from '../useInfrastructureHealth';

interface AlertsPanelProps {
    alerts: SystemAlert[];
    loading: boolean;
}

// ─── Config per alert type / severity ─────────────────────────────────────────
const SEVERITY_CONFIG = {
    CRITICAL: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        badge: 'bg-red-500/20 text-red-400 border-red-500/30',
        icon: AlertTriangle,
        iconColor: 'text-red-400',
        dot: 'bg-red-400',
    },
    HIGH: {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        icon: AlertCircle,
        iconColor: 'text-orange-400',
        dot: 'bg-orange-400',
    },
    MEDIUM: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        icon: Clock,
        iconColor: 'text-amber-400',
        dot: 'bg-amber-400',
    },
    LOW: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        icon: Shield,
        iconColor: 'text-blue-400',
        dot: 'bg-blue-400',
    },
} as const;

const ALERT_TYPE_LABEL = {
    CRITICAL_ASSET: 'Critical Asset',
    OVERDUE_INSPECTION: 'Overdue Inspection',
    HIGH_RISK_ZONE: 'High Risk Zone',
} as const;

const AlertItem = React.memo(({ alert, index }: { alert: SystemAlert; index: number }) => {
    const cfg = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.LOW;
    const Icon = cfg.icon;
    const TypeIcon = alert.alert_type === 'HIGH_RISK_ZONE' ? MapPin
        : alert.alert_type === 'OVERDUE_INSPECTION' ? Clock
            : AlertTriangle;
    const typeLabel = ALERT_TYPE_LABEL[alert.alert_type as keyof typeof ALERT_TYPE_LABEL];

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.04, duration: 0.25 }}
            className={`flex items-start gap-3 p-4 rounded-xl border ${cfg.bg} ${cfg.border}`}
        >
            {/* Severity Icon */}
            <div className="shrink-0 mt-0.5">
                <Icon size={16} className={cfg.iconColor} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
                        {alert.severity}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <TypeIcon size={10} />
                        {typeLabel}
                    </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{alert.message}</p>
            </div>

            {/* Live pulse dot */}
            <div className="shrink-0 mt-1.5">
                <span className={`block w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
            </div>
        </motion.div>
    );
});

// Alert skeleton
const AlertSkeleton = () => (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-[#233554] bg-[#112240]/40 animate-pulse">
        <div className="w-4 h-4 rounded bg-[#233554] mt-0.5 shrink-0" />
        <div className="flex-1 space-y-2">
            <div className="w-24 h-3 rounded bg-[#233554]" />
            <div className="w-full h-3 rounded bg-[#233554]" />
        </div>
    </div>
);

// ─── Main AlertsPanel ─────────────────────────────────────────────────────────
const AlertsPanel = ({ alerts, loading }: AlertsPanelProps) => {
    const [dismissed, setDismissed] = React.useState<Set<number>>(new Set());
    const visible = alerts.filter((_, i) => !dismissed.has(i));

    const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length;
    const highCount = alerts.filter(a => a.severity === 'HIGH').length;

    return (
        <div className="glass-panel p-6 rounded-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-400" />
                        System Alerts
                    </h3>
                    {!loading && alerts.length > 0 && (
                        <div className="flex items-center gap-1.5">
                            {criticalCount > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                                    {criticalCount} CRITICAL
                                </span>
                            )}
                            {highCount > 0 && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                    {highCount} HIGH
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {!loading && (
                    <span className="text-xs text-slate-500">
                        {visible.length} active
                    </span>
                )}
            </div>

            {/* Alert list */}
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <AlertSkeleton key={i} />)
                ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                        <Shield size={32} className="text-emerald-400 mb-3" />
                        <p className="text-sm font-medium text-emerald-400">All Systems Operational</p>
                        <p className="text-xs text-slate-500 mt-1">No active alerts detected</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {visible.map((alert, i) => (
                            <div key={i} className="relative group">
                                <AlertItem alert={alert} index={i} />
                                {/* Dismiss button on hover */}
                                <button
                                    onClick={() => setDismissed(prev => new Set([...prev, alerts.indexOf(alert)]))}
                                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-slate-500 hover:text-slate-300"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};

export default AlertsPanel;
