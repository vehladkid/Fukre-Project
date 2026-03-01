import { useEffect, useRef } from 'react';
import { AlertCircle, Activity, Droplets, ShieldAlert, Zap } from 'lucide-react';
import { useSimulationLogs, type SimulationLog } from '../hooks/useSimulationLogs';
import { useSimulation } from '../context/SimulationContext';

const getIcon = (type: SimulationLog['event_type']) => {
    switch (type) {
        case 'STRESSED': return <Activity size={14} className="text-yellow-400" />;
        case 'DEGRADED': return <AlertCircle size={14} className="text-orange-400" />;
        case 'FAILED': return <Zap size={14} className="text-red-500" />;
        case 'FLOOD': return <Droplets size={14} className="text-blue-400" />;
        case 'SYSTEM': return <ShieldAlert size={14} className="text-slate-400" />;
        default: return <Activity size={14} className="text-slate-400" />;
    }
};

export const LiveIncidentLog = () => {
    const { logs } = useSimulationLogs();
    const { isActive } = useSimulation();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to newest entries
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 0; // Newest are at the top due to unshift
        }
    }, [logs]);

    if (!isActive) return null;

    return (
        <div className="absolute top-20 left-6 z-[1200] pointer-events-auto transition-all duration-300 w-72">
            <div className={`bg-[#0a192f]/95 backdrop-blur-md border border-[#233554] shadow-2xl rounded-xl overflow-hidden flex flex-col h-96`}>

                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-[#233554] bg-[#112240]">
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-red-400 animate-pulse" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
                            Live Incident Log
                        </h3>
                    </div>
                    <span className="text-xs font-mono text-slate-500 bg-black/20 px-2 py-0.5 rounded border border-slate-700">
                        {logs.length} events
                    </span>
                </div>

                {/* Log List */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                    {logs.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-slate-500 text-xs italic">
                            Waiting for simulation events...
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="flex gap-3 items-start p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                <div className="mt-0.5 shrink-0 bg-[#0a192f] p-1.5 rounded-md border border-slate-700/50">
                                    {getIcon(log.event_type)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-200 leading-tight">
                                        {log.message}
                                    </p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className={`text-[10px] uppercase font-bold tracking-wider ${log.severity === 'critical' ? 'text-red-400' :
                                                log.severity === 'high' ? 'text-orange-400' :
                                                    log.severity === 'medium' ? 'text-yellow-400' : 'text-slate-400'
                                            }`}>
                                            {log.severity}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-500">
                                            {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};
