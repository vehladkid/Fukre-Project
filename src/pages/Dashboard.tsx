import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Hammer,
  TrendingUp,
  Download,
  RefreshCw,
  Wrench,
} from 'lucide-react';
import { useInfrastructureAnalytics } from '../features/reports/useInfrastructureAnalytics';
import {
  PieChart,
  Pie,
  Cell,
  Sector,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useSimulation } from '../features/simulation/context/SimulationContext';

// ─── Custom Pie Active Shape (expands segment outward, no tooltip overlap) ──
interface ActiveShapeProps {
  cx: number; cy: number;
  innerRadius: number; outerRadius: number;
  startAngle: number; endAngle: number;
  fill?: string;
}
const renderActiveShape = (props: ActiveShapeProps) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill = '#888' } = props;
  return (
    <g>
      {/* Glow halo */}
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 10}
        startAngle={startAngle} endAngle={endAngle}
        fill={fill} opacity={0.12}
      />
      {/* Expanded active segment */}
      <Sector
        cx={cx} cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 7}
        startAngle={startAngle} endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

// ─── Custom Pie Tooltip — anchored below chart, never overlaps donut ─────────
interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string; value: number; color: string } }>;
}
const CustomPieTooltip = ({ active, payload }: PieTooltipProps) => {
  if (!active || !payload?.length) return null;
  const { name, value, color } = payload[0].payload;
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[#233554] bg-[#0a192f] shadow-2xl">
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs font-medium text-slate-300">{name}</span>
      <span className="text-xs font-bold text-white tabular-nums ml-1">{value}</span>
    </div>
  );
};

// ─── KPI Skeleton ──────────────────────────────────────────────────────────
const KpiSkeleton = () => (
  <div className="glass-card p-6 rounded-2xl animate-pulse">
    <div className="flex items-center justify-between mb-4">
      <div className="w-12 h-12 rounded-lg bg-[#233554]" />
      <div className="w-14 h-5 rounded-full bg-[#233554]" />
    </div>
    <div className="w-20 h-8 rounded bg-[#233554] mb-2" />
    <div className="w-28 h-4 rounded bg-[#233554]" />
  </div>
);

// ─── KPI Card ─────────────────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  iconColor: string;
  trend?: string;
  highlight?: 'danger' | 'warning' | 'success';
}
const KpiCard = React.memo(({ title, value, icon: Icon, iconColor, trend, highlight }: KpiCardProps) => {
  const borderColor = highlight === 'danger' ? 'border-red-500/30' : highlight === 'warning' ? 'border-amber-500/30' : 'border-[#233554]';
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={`glass-card p-6 rounded-2xl relative overflow-hidden group border ${borderColor}`}
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon size={80} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-lg bg-white/5`}>
            <Icon size={22} className={iconColor} />
          </div>
          {trend && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded-full">
              <TrendingUp size={12} />
              {trend}
            </span>
          )}
        </div>
        <h3 className="text-3xl font-bold text-white mb-1 tabular-nums">{value.toLocaleString()}</h3>
        <p className="text-sm text-slate-400 font-medium">{title}</p>
      </div>
    </motion.div>
  );
});

// ─── Chart Skeleton ────────────────────────────────────────────────────────
const ChartSkeleton = ({ height = 250 }: { height?: number }) => (
  <div className={`w-full rounded-xl bg-[#112240]/50 animate-pulse`} style={{ height }} />
);

// ─── CSV Export Button ─────────────────────────────────────────────────────
const ExportReportButton = ({ role }: { role: string | null }) => {
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from('export_assets_view')
        .select('*');

      if (error || !data) throw error ?? new Error('No data');

      const headers = ['ID', 'Asset Name', 'Zone', 'Category', 'Status', 'Severity', 'Last Inspected', 'Installation Date', 'Latitude', 'Longitude', 'Created At'];
      const rows = data.map(r => [
        r.id,
        `"${(r.asset_name ?? '').replace(/"/g, '""')}"`,
        `"${(r.zone ?? '').replace(/"/g, '""')}"`,
        `"${(r.category ?? '').replace(/"/g, '""')}"`,
        `"${(r.status ?? '').replace(/"/g, '""')}"`,
        r.severity_level,
        r.last_inspected ?? '',
        r.installation_date ?? '',
        r.latitude ?? '',
        r.longitude ?? '',
        r.created_at ?? '',
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `uiip_infrastructure_report_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  if (role === 'viewer') return null;

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-2 px-4 py-2 bg-[#112240] hover:bg-[#1d3b5a] disabled:opacity-50 text-slate-300 rounded-lg text-sm font-medium transition-colors border border-[#233554]"
    >
      <Download size={16} />
      {exporting ? 'Exporting...' : 'Export CSV'}
    </button>
  );
};

// ─── Dashboard ─────────────────────────────────────────────────────────────
const Dashboard = () => {
  const { analytics, loading, error, refreshAnalytics } = useInfrastructureAnalytics();
  const { role } = useAuth();
  const { isActive: simActive, simulatedCityHealth } = useSimulation();
  const { kpis, statusDistribution, categoryMaintenance } = analytics;

  // KPIs and pie chart share the same statusCounts map — single source of truth
  const { total_assets, statusCounts } = kpis;

  const operationalCount = statusCounts['Operational'] ?? 0;
  const operationalPct = total_assets > 0
    ? Math.round((operationalCount / total_assets) * 100)
    : 0;

  // Recharts pie data — same statusDistribution array as KPIs
  const pieData = statusDistribution.map(s => ({
    name: s.status_name,
    value: Number(s.asset_count),
    color: s.color_code,
  }));



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold text-white">City Intelligence Dashboard</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-400">Aggregated infrastructure analytics — live from database</p>
            {simActive && (
              <span className="bg-red-500/10 border border-red-500/30 text-red-500 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                SIMULATED DATA ACTIVE
              </span>
            )}
            {simActive && simulatedCityHealth !== null && (
              <span className="bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                SIMULATED HEALTH: {simulatedCityHealth}%
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refreshAnalytics}
            className="flex items-center gap-2 px-4 py-2 bg-[#112240] hover:bg-[#1d3b5a] text-slate-300 rounded-lg text-sm font-medium transition-colors border border-[#233554]"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <ExportReportButton role={role} />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          ⚠ Failed to load analytics: {error}
        </div>
      )}

      {/* KPI Cards — values derived from statusCounts (same source as pie chart) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard title="Total Assets" value={total_assets} icon={Building2} iconColor="text-blue-400" />
            <KpiCard title="Operational" value={statusCounts['Operational'] ?? 0} icon={CheckCircle2} iconColor="text-emerald-400" highlight="success" />
            <KpiCard title="Maintenance Required" value={statusCounts['Maintenance Required'] ?? 0} icon={Wrench} iconColor="text-amber-400" highlight="warning" />
            <KpiCard title="Under Repair" value={statusCounts['Under Repair'] ?? 0} icon={Hammer} iconColor="text-orange-400" />
            <KpiCard title="Critical" value={statusCounts['Critical'] ?? 0} icon={AlertTriangle} iconColor="text-red-400" highlight="danger" />
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart — Status Distribution */}
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-semibold text-white mb-4">Status Distribution</h3>
          {/* overflow-visible so tooltip isn't clipped by the panel */}
          <div className="h-[180px] w-full relative" style={{ overflow: 'visible' }}>
            {loading ? <ChartSkeleton height={180} /> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                    activeShape={renderActiveShape}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={<CustomPieTooltip />}
                    wrapperStyle={{
                      pointerEvents: 'none',
                      zIndex: 1000,
                      // Anchor tooltip below chart, outside donut radius
                      top: 'auto',
                      bottom: -48,
                      left: '50%',
                      transform: 'translateX(-50%)',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {/* Center KPI */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-white tabular-nums">{operationalPct}%</span>
              <span className="text-xs text-slate-400">Operational</span>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-4 rounded bg-[#233554] animate-pulse" />
              ))
            ) : pieData.map(item => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300 text-xs">{item.name}</span>
                </div>
                <span className="font-semibold text-white font-mono text-xs">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Maintenance Load by Category */}
      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <Wrench size={18} className="text-amber-400" />
          Maintenance Load by Category
        </h3>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-[#112240]/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categoryMaintenance.map(cat => (
              <div
                key={cat.category_id}
                className={`p-4 rounded-xl border ${cat.critical_count > 0 ? 'border-red-500/30 bg-red-900/5' : 'border-[#233554] bg-[#112240]/40'}`}
              >
                <p className="text-sm font-semibold text-white mb-3">{cat.category_name}</p>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Total</span>
                    <span className="font-mono text-slate-200">{cat.total_assets}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-400">Maintenance</span>
                    <span className="font-mono text-amber-300">{cat.maintenance_count}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-red-400">Critical</span>
                    <span className="font-mono text-red-300">{cat.critical_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Alerts footer */}
      <div className="glass-panel p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-400" />
            At-Risk Summary
          </h3>
          <span className="text-sm text-slate-400">
            {loading ? '–' : (statusCounts['Critical'] ?? 0) + (statusCounts['Maintenance Required'] ?? 0) + (statusCounts['Under Repair'] ?? 0)} assets require attention
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Critical Assets', value: statusCounts['Critical'] ?? 0, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
            { label: 'Maintenance Required', value: statusCounts['Maintenance Required'] ?? 0, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'Under Repair', value: statusCounts['Under Repair'] ?? 0, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
          ].map(item => (
            <div key={item.label} className={`flex items-center justify-between p-4 rounded-xl border ${item.bg}`}>
              <div className="flex items-center gap-3">
                <Clock size={16} className={item.color} />
                <span className="text-sm text-slate-300">{item.label}</span>
              </div>
              <span className={`text-2xl font-bold tabular-nums ${item.color}`}>
                {loading ? '–' : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
