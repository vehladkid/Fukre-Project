import React from 'react';
import { BrainCircuit, Activity, Trash2, Zap } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMapUIState } from '../hooks/useMapUIState';

const MapToolbar: React.FC = () => {
    const {
        showTopology,
        showPredictions,
        isCleanMode,
        toggleTopology,
        togglePredictions,
        hideAllPanels
    } = useMapUIState();

    const location = useLocation();
    const navigate = useNavigate();
    const isSandbox = location.pathname.includes('/simulation');

    if (isCleanMode) return null;

    // Sandbox: replace toolbar with DIGITAL TWIN ACTIVE badge
    if (isSandbox) {
        return (
            <div className="absolute top-4 right-4 z-[var(--z-toolbar)] flex gap-2 pointer-events-none">
                <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg shadow-lg backdrop-blur-md">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider">DIGITAL TWIN ACTIVE</span>
                </div>
            </div>
        );
    }

    // Normal map view
    return (
        <div className="absolute top-4 right-4 z-[var(--z-toolbar)] flex gap-2 pointer-events-auto items-center">

            {/* ENTER DIGITAL TWIN — replaces Layers button */}
            <button
                onClick={() => navigate('/simulation')}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all backdrop-blur-md border bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20 hover:text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                title="Launch Digital Twin Simulation"
            >
                <Zap size={15} fill="currentColor" />
                ENTER DIGITAL TWIN
            </button>

            {/* AI Predictions Toggle */}
            <button
                onClick={togglePredictions}
                title="Toggle AI Prediction Engine"
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all backdrop-blur-md border ${showPredictions
                    ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                    : 'bg-[#0a192f]/80 border-[#233554] text-slate-400 hover:text-white hover:bg-[#112240]'
                    }`}
            >
                <BrainCircuit size={18} />
            </button>

            {/* Topology Toggle */}
            <button
                onClick={toggleTopology}
                title="Toggle Asset Topology"
                className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all backdrop-blur-md border ${showTopology
                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                    : 'bg-[#0a192f]/80 border-[#233554] text-slate-400 hover:text-white hover:bg-[#112240]'
                    }`}
            >
                <Activity size={18} />
            </button>

            {/* Clear UI */}
            <div className="w-px h-6 bg-[#233554] self-center mx-1" />

            <button
                onClick={hideAllPanels}
                title="Clear Overlays"
                className="flex items-center justify-center w-10 h-10 rounded-lg transition-all backdrop-blur-md bg-[#0a192f]/80 border border-[#233554] text-slate-500 hover:text-red-400 hover:bg-[#112240]"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
};

export default MapToolbar;
