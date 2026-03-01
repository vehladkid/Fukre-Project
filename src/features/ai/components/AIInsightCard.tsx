import React from 'react';
import { BrainCircuit, Clock, ShieldAlert, Activity, ChevronRight } from 'lucide-react';
import { type AIPrediction } from '../hooks/useAIPredictions';
import { useMapUIState } from '../../map/hooks/useMapUIState';

interface AIInsightCardProps {
    predictions: AIPrediction[];
}

const AIInsightCard = React.memo(({ predictions }: AIInsightCardProps) => {
    const { showPredictions, togglePredictions, isCleanMode } = useMapUIState();

    if (predictions.length === 0 || isCleanMode) return null;

    if (!showPredictions) {
        return null;
    }

    return (
        <div className="absolute bottom-6 left-6 z-[var(--z-drawer)] w-80 panel-slide-left pointer-events-auto">
            <div className="bg-[#0a192f]/95 backdrop-blur-md border border-[#233554] shadow-[0_8px_32px_rgba(0,0,0,0.5)] rounded-xl overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-red-900/40 to-[#0a192f] border-b border-[#233554] p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-red-400">
                        <BrainCircuit size={18} className="animate-pulse" />
                        <h3 className="font-bold text-sm uppercase tracking-wider">Prediction Engine</h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
                            LIVE
                        </span>
                        <button
                            onClick={togglePredictions}
                            className="text-slate-400 hover:text-white transition-colors p-1"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>

                {/* Predictions List */}
                <div className="p-2">
                    {predictions.map((pred) => (
                        <div key={pred.id + '_' + pred.score} className="p-3 border-b border-[#233554]/50 last:border-0 hover:bg-[#112240] transition-colors rounded-lg group">

                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <h4 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors line-clamp-1">{pred.name}</h4>
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                        <Activity size={12} />
                                        Prediction: Structural Degradation
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-bold text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
                                        {(pred.score).toFixed(1)}/10 RISK
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-xs mt-3">
                                <div className="flex items-center gap-1.5 text-slate-400">
                                    <Clock size={13} className="text-amber-400" />
                                    <span>Forecast: <strong className="text-amber-400">{pred.timeline}</strong></span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-400">
                                    <ShieldAlert size={13} className="text-teal-400" />
                                    <span>Confidence: <strong className="text-teal-400">{(pred.confidence).toFixed(1)}%</strong></span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
});

export default AIInsightCard;
