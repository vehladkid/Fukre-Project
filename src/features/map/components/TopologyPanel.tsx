import React, { useMemo } from 'react';
import { useTopologyCount } from '../useTopologyCount';
import { useMapUIState } from '../hooks/useMapUIState';
import { getLODMode } from '../hooks/useLODAssets';

const LOD_MODE_LABELS: Record<string, { label: string; color: string }> = {
    city: { label: 'City View', color: '#64748b' },
    district: { label: 'District View', color: '#f59e0b' },
    street: { label: 'Street View', color: '#22c55e' },
};

interface TopologyPanelProps {
    zoom: number;
}

const TopologyPanel: React.FC<TopologyPanelProps> = ({ zoom }) => {
    const { showTopology, isCleanMode } = useMapUIState();
    const { counts: topologyCounts, total: totalAssets } = useTopologyCount();

    const lodMode = useMemo(() => getLODMode(zoom), [zoom]);
    const lodBadge = LOD_MODE_LABELS[lodMode];

    if (!showTopology || isCleanMode) return null;

    return (
        <div className="absolute top-20 right-4 z-[var(--z-drawer)] flex flex-col gap-2 pointer-events-none panel-slide-right">
            <div className="bg-[#112240]/92 p-4 rounded-xl border border-[#233554] shadow-xl w-72 pointer-events-auto backdrop-blur-md">
                <div className="flex items-center justify-between mb-3 border-b border-[#233554] pb-3">
                    <div>
                        <h4 className="text-white font-semibold text-sm">Asset Topology</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Total Mapped: {totalAssets.toLocaleString()}</p>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-xs text-slate-400 font-mono mb-1">z{Math.round(zoom)}</span>
                        <div className="px-2 py-0.5 rounded text-[10px] font-mono"
                            style={{
                                borderColor: lodBadge.color + '60',
                                color: lodBadge.color,
                                backgroundColor: lodBadge.color + '15',
                                borderWidth: '1px'
                            }}>
                            {lodBadge.label}
                        </div>
                    </div>
                </div>

                <div className="space-y-2.5">
                    {topologyCounts.length === 0 ? (
                        <p className="text-slate-500 text-xs italic">Loading topology...</p>
                    ) : (
                        topologyCounts.map(({ status_name, color_code, count }) => (
                            <TopologyItem
                                key={status_name}
                                label={status_name}
                                count={count}
                                color={color_code}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Item helper Component ───────────────────────────────────────────────────
function TopologyItem({ label, count, color }: { label: string; count: number; color: string }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}88` }}
                />
                <span className="text-sm text-slate-300">{label}</span>
            </div>
            <span className="font-mono text-sm text-white bg-[#0a192f] px-2 py-0.5 rounded border border-[#233554]">
                {count.toLocaleString()}
            </span>
        </div>
    );
}

export default TopologyPanel;
