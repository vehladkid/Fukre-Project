import { X, History, Loader2, Calendar } from 'lucide-react';
import { useAssetHistory, type AssetHistoryLog } from '../useAssetHistory';
import ChangeDiffViewer from './ChangeDiffViewer';
import { type AuditLog } from '../useAuditLogs';
import React, { useState } from 'react';

interface Props {
    assetId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).format(new Date(dateString));
};

// Internal timeline node component wrapped in React.memo
const TimelineNode = React.memo(({ log, index, total }: { log: AssetHistoryLog; index: number; total: number }) => {
    const [expanded, setExpanded] = useState(false);

    let badgeClass = '';
    let actionLabel = '';

    switch (log.action) {
        case 'INSERT':
            badgeClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
            actionLabel = 'Asset Created';
            break;
        case 'UPDATE':
            badgeClass = 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
            actionLabel = 'Asset Updated';
            break;
        case 'DELETE':
            badgeClass = 'bg-red-500/10 text-red-400 border border-red-500/20';
            actionLabel = 'Asset Removed';
            break;
    }

    const isLast = index === total - 1;

    return (
        <div className="relative pl-6 pb-6">
            {!isLast && (
                <div className="absolute left-[11px] top-6 bottom-0 w-px bg-[#233554]"></div>
            )}

            <div className="absolute left-0 top-1.5 w-[22px] h-[22px] rounded-full flex items-center justify-center bg-[#0a192f] border-2 border-[#233554] z-10">
                <div className={`w-2 h-2 rounded-full ${log.action === 'INSERT' ? 'bg-emerald-400' :
                        log.action === 'UPDATE' ? 'bg-blue-400' : 'bg-red-400'
                    }`}></div>
            </div>

            <div
                className="bg-[#0a192f] border border-[#233554] rounded-xl p-3 shadow-lg hover:border-teal-500/30 transition-colors cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-wide ${badgeClass}`}>
                        {actionLabel}
                    </span>
                    <span className="text-xs text-slate-500 font-mono flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(log.created_at)}
                    </span>
                </div>

                <div className="text-sm text-slate-300 mt-1">
                    Operator: <span className="font-medium text-slate-100">{log.operator_name || 'System'}</span>
                    <span className="text-slate-500 text-xs ml-2 capitalize">({log.operator_role || 'Automation'})</span>
                </div>

                {expanded && (
                    <div className="mt-3">
                        <ChangeDiffViewer log={log as unknown as AuditLog} />
                    </div>
                )}
            </div>
        </div>
    );
});

export const AssetHistoryPanel = React.memo(({ assetId, isOpen, onClose }: Props) => {
    // Defers network fetch until isOpen is true, serves cache instantly
    const { history, loading, error } = useAssetHistory(assetId, isOpen);

    const displayTitle = history.length > 0 ? history[0].asset_name || 'Unknown Asset' : 'Loading...';

    // Query is DESC, display ASC for chronological timeline
    const chronologicalHistory = [...history].reverse();

    return (
        <>
            {/* Clickaway — NO blur, NO backdrop-filter, just a transparent click target */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[1000]"
                    onClick={onClose}
                />
            )}

            {/* Sliding Panel — position:fixed, no blur effect on anything */}
            <div
                className={`fixed inset-y-0 right-0 z-[1001] w-full max-w-md bg-[#112240] border-l border-[#233554] shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="p-4 border-b border-[#233554] flex justify-between items-center bg-[#0a192f]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-500/10 text-teal-400 rounded-lg">
                            <History size={20} />
                        </div>
                        <div>
                            <h2 className="text-white font-bold text-lg leading-tight truncate max-w-[250px]">
                                {assetId ? displayTitle : 'Intelligence View'}
                            </h2>
                            <p className="text-slate-400 text-xs font-mono">
                                ID: <span className="text-teal-400">{assetId ? `${assetId.split('-')[0]}...` : 'Inactive'}</span>
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white hover:bg-[#233554] rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body / Timeline */}
                <div className="flex-1 overflow-y-auto p-6">
                    {!isOpen ? null : loading ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-3">
                            <Loader2 className="animate-spin text-teal-400 h-8 w-8" />
                            <span className="text-slate-400 text-sm">Retrieving lifecycle...</span>
                        </div>
                    ) : error ? (
                        <div className="p-4 bg-red-900/10 border border-red-500/20 rounded-xl text-center">
                            <span className="text-red-400 text-sm">{error}</span>
                        </div>
                    ) : chronologicalHistory.length === 0 ? (
                        <div className="text-center py-10 border border-dashed border-[#233554] rounded-xl bg-[#0a192f]/50">
                            <History className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                            <span className="text-slate-400 text-sm block">No history recorded yet.</span>
                        </div>
                    ) : (
                        <div className="pt-2">
                            {chronologicalHistory.map((log, index) => (
                                <TimelineNode
                                    key={log.id}
                                    log={log}
                                    index={index}
                                    total={chronologicalHistory.length}
                                />
                            ))}

                            <div className="flex items-center gap-3 pt-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#233554] ml-2.5"></div>
                                <span className="text-xs font-medium text-slate-500 tracking-wider">END OF LIFECYCLE</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
});
