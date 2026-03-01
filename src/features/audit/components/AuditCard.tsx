import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { type AuditLog } from '../useAuditLogs';
import ChangeDiffViewer from './ChangeDiffViewer';

interface Props {
    log: AuditLog;
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

export const AuditCard = ({ log }: Props) => {
    const [expanded, setExpanded] = useState(false);

    let ActionBadge = null;
    let actionBg = '';

    switch (log.action) {
        case 'INSERT':
            ActionBadge = <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold text-xs tracking-wide">INSERT</span>;
            actionBg = 'hover:bg-emerald-900/10';
            break;
        case 'UPDATE':
            ActionBadge = <span className="px-2 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-bold text-xs tracking-wide">UPDATE</span>;
            actionBg = 'hover:bg-blue-900/10';
            break;
        case 'DELETE':
            ActionBadge = <span className="px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-bold text-xs tracking-wide">DELETE</span>;
            actionBg = 'hover:bg-red-900/10';
            break;
    }

    const operatorInitial = (log.operator_name || 'System').charAt(0).toUpperCase();

    return (
        <div className={`bg-[#112240] border border-[#233554] rounded-xl overflow-hidden shadow-lg transition-colors ${expanded ? 'border-teal-500/30' : ''}`}>
            {/* Header Row (Always visible) */}
            <div
                className={`p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between cursor-pointer ${actionBg} transition-colors`}
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="shrink-0">
                        {ActionBadge}
                    </div>

                    <div className="flex flex-col min-w-0">
                        <span className="text-slate-200 font-mono text-sm truncate" title={log.record_id}>
                            Asset ID: <span className="text-teal-400">{log.record_id.split('-')[0]}...</span>
                        </span>
                        <span className="text-slate-500 text-xs mt-0.5">{formatDate(log.created_at)}</span>
                    </div>
                </div>

                <div className="flex justify-between items-center w-full md:w-auto gap-6 shrink-0 border-t md:border-t-0 border-[#233554] pt-3 md:pt-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#0a192f] border border-[#233554] flex items-center justify-center text-xs font-bold text-slate-300">
                            {operatorInitial}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-200">{log.operator_name || 'System Auto'}</span>
                            <span className="text-xs text-slate-500 capitalize">{log.operator_role || 'Automation'}</span>
                        </div>
                    </div>

                    <button className="text-slate-400 p-1 hover:text-white hover:bg-[#233554] rounded transition-colors shrink-0">
                        {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                </div>
            </div>

            {/* Expandable Body */}
            {expanded && (
                <div className="p-4 border-t border-[#233554] bg-[#0a192f]/50">
                    <ChangeDiffViewer log={log} />
                </div>
            )}
        </div>
    );
};
