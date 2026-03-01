import React from 'react';
import { type AuditLog } from '../useAuditLogs';

interface Props {
    log: AuditLog;
}

const ChangeDiffViewer = React.memo(({ log }: Props) => {
    // INSERT - Only show new data
    if (log.action === 'INSERT') {
        const newData = log.after_data || {};
        return (
            <div className="bg-[#0a192f] rounded-lg border border-[#233554] p-4 text-sm font-mono mt-3 overflow-x-auto">
                <div className="text-slate-400 mb-2 border-b border-[#233554] pb-2 text-xs uppercase tracking-wider font-bold">New Record Data</div>
                {Object.entries(newData).map(([key, value]) => {
                    // Skip internal fields usually not useful to admins visually
                    if (key === 'id' || key === 'created_at' || key === 'updated_at') return null;
                    return (
                        <div key={key} className="flex gap-4 py-1">
                            <span className="text-slate-500 w-32 shrink-0">{key}:</span>
                            <span className="text-teal-400 break-all">{String(value ?? 'null')}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    // UPDATE - Show exact Old vs New on changed fields
    if (log.action === 'UPDATE') {
        const changedKeys = log.changed_fields ? Object.keys(log.changed_fields) : [];

        if (changedKeys.length === 0) {
            return (
                <div className="bg-[#0a192f] rounded-lg border border-[#233554] p-4 text-sm font-mono mt-3 text-slate-500 italic">
                    Silent update recorded (no fields altered).
                </div>
            );
        }

        return (
            <div className="bg-[#0a192f] rounded-lg border border-[#233554] p-4 text-sm font-mono mt-3 overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-[#233554] text-xs uppercase tracking-wider text-slate-400">
                            <th className="pb-2 font-bold w-1/3">Field</th>
                            <th className="pb-2 font-bold w-1/3 text-red-400">Old Value</th>
                            <th className="pb-2 font-bold w-1/3 text-teal-400">New Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#233554]/50">
                        {changedKeys.map(key => {
                            const oldVal = log.before_data ? log.before_data[key] : 'null';
                            const newVal = log.after_data ? log.after_data[key] : 'null';

                            // Skip if they are exactly the same
                            if (oldVal === newVal) return null;

                            return (
                                <tr key={key} className="hover:bg-[#112240] transition-colors">
                                    <td className="py-2 text-slate-300 pr-4">{key}</td>
                                    <td className="py-2 text-red-400/90 pr-4 break-all bg-red-500/5 px-2 rounded-l-md border-l border-red-500/20 my-1 block lg:table-cell">{String(oldVal ?? 'null')}</td>
                                    <td className="py-2 text-emerald-400/90 break-all bg-emerald-500/5 px-2 rounded-r-md border-r border-teal-500/20 my-1 block lg:table-cell">{String(newVal ?? 'null')}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

    // DELETE - Show old data that got wiped out
    if (log.action === 'DELETE') {
        const oldData = log.before_data || {};
        return (
            <div className="bg-[#0a192f] rounded-lg border border-red-900/40 p-4 text-sm font-mono mt-3 overflow-x-auto relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1 bg-red-500/50"></div>
                <div className="text-red-400 mb-2 border-b border-[#233554] pb-2 text-xs uppercase tracking-wider font-bold">Deleted Record State</div>
                {Object.entries(oldData).map(([key, value]) => {
                    if (key === 'created_at' || key === 'updated_at') return null;
                    return (
                        <div key={key} className="flex gap-4 py-1">
                            <span className="text-slate-500 w-32 shrink-0">{key}:</span>
                            <span className="text-slate-300 break-all">{String(value ?? 'null')}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return null;
});

export default ChangeDiffViewer;
