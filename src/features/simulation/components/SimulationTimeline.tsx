import { Clock, AlertTriangle, Droplets, Activity, CheckCircle } from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';

export const SimulationTimeline = () => {
    const { timeline, isActive, simTimeSeconds } = useSimulation();

    if (!isActive || timeline.length === 0) return null;

    const visibleEvents = timeline.slice(0, 5);
    const renderIcon = (type: string) => {
        switch (type) {
            case 'FAILURE': return <AlertTriangle size={14} className="text-orange-500" />;
            case 'FLOOD': return <Droplets size={14} className="text-blue-500" />;
            case 'WARNING': return <Activity size={14} className="text-amber-500" />;
            case 'RECOVERY': return <CheckCircle size={14} className="text-emerald-500" />;
            case 'SYSTEM': return <Activity size={14} className="text-teal-500" />;
            default: return <Clock size={14} className="text-slate-400" />;
        }
    };

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1150] pointer-events-auto fade-scale-in w-[420px]">
            <div className="bg-[#0a192f]/95 backdrop-blur-md border border-red-500/30 rounded-xl shadow-[0_8px_32px_rgba(239,68,68,0.15)] overflow-hidden">
                <div className="bg-red-500/10 px-4 py-2 border-b border-red-500/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Live Simulation Timeline
                    </span>
                    <span className="text-xs text-slate-500 font-mono">T+{simTimeSeconds}s</span>
                </div>

                <div className="p-3 bg-[#0a192f] max-h-48 overflow-y-auto custom-scrollbar flex flex-col-reverse gap-2">
                    {visibleEvents.map((evt, idx) => (
                        <div key={evt.id} className="flex gap-3 items-start animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                            <div className="mt-1 flex-shrink-0">
                                {renderIcon(evt.type)}
                            </div>
                            <div>
                                <p className={`text-sm ${evt.type === 'FAILURE' ? 'text-slate-200' : 'text-slate-400'}`}>
                                    {evt.message}
                                </p>
                                <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                                    {new Date(evt.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
