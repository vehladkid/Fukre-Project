import React, { useState } from 'react';
import { Circle, LayerGroup, useMap } from 'react-leaflet';
import { Layers, Activity, AlertTriangle, Droplets, Car } from 'lucide-react';
import { type AIOverlayCluster } from '../hooks/useAIPredictions';
import { useMapUIState } from '../../map/hooks/useMapUIState';
import { useSimulation } from '../../simulation/context/SimulationContext';

interface AIOverlayPanelProps {
    riskClusters: AIOverlayCluster[];
    densityClusters: AIOverlayCluster[];
    trafficClusters: AIOverlayCluster[];
}

const AIOverlayPanel = React.memo(({ riskClusters, densityClusters, trafficClusters }: AIOverlayPanelProps) => {
    const { showIntelligenceLayers, isCleanMode } = useMapUIState();

    const [showHighRisk, setShowHighRisk] = useState(true);
    const [showMediumRisk, setShowMediumRisk] = useState(false);
    const [showLowRisk, setShowLowRisk] = useState(false);
    const [showFlood, setShowFlood] = useState(false);
    const [showTraffic, setShowTraffic] = useState(false);

    const map = useMap();

    React.useEffect(() => {
        if (!map.getPane("floodPane")) {
            const pane = map.createPane("floodPane");
            pane.style.zIndex = "450";
        }
    }, [map]);

    const { isFloodActive } = useSimulation();

    // Dynamic rendering of risk layers
    const renderRiskCircles = () => {
        return riskClusters.map(cluster => {
            // Determine level and skip if toggled off
            const isHigh = cluster.avgRiskRaw > 1.5;
            const isMedium = cluster.avgRiskRaw > 0.5 && cluster.avgRiskRaw <= 1.5;
            const isLow = cluster.avgRiskRaw <= 0.5;

            if (isHigh && !showHighRisk) return null;
            if (isMedium && !showMediumRisk) return null;
            if (isLow && !showLowRisk) return null;

            let color = '#22c55e'; // Green
            let className = 'subtle-breathing-green';
            let opacity = 0.15;

            if (isHigh) {
                color = '#ef4444'; // Red
                className = 'pulse-red';
                opacity = 0.25;
            } else if (isMedium) {
                color = '#f59e0b'; // Amber
                className = 'amber-glow';
                opacity = 0.2;
            }

            return (
                <Circle
                    key={cluster.id}
                    center={[cluster.latitude, cluster.longitude]}
                    radius={Math.max(200, cluster.assetCount * 30)}
                    pathOptions={{ color, fillColor: color, fillOpacity: opacity, weight: 1, className }}
                />
            );
        });
    };

    const renderFloodPolygons = () => {
        if ((!showFlood && !isFloodActive) || map.getZoom() < 11) return null; // Apply only when zoom >= 11

        return densityClusters.slice(0, 120).map(cluster => {
            // Radius scales with zoom but minimum 80m
            const baseRadius = cluster.assetCount * 40;
            const dynamicRadius = Math.max(80, baseRadius);

            return (
                <Circle
                    key={`flood_${cluster.id}`}
                    pane="floodPane"
                    center={[cluster.latitude, cluster.longitude]}
                    radius={dynamicRadius}
                    pathOptions={{
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.18,
                        weight: 0,
                        className: 'animate-[floodPulse_3s_ease-in-out_infinite]' // Apply floodPulse animation
                    }}
                />
            );
        });
    };

    const renderTrafficOverlays = () => {
        if (!showTraffic) return null;
        return trafficClusters.map(cluster => (
            <Circle
                key={`traffic_${cluster.id}`}
                center={[cluster.latitude, cluster.longitude]}
                radius={Math.max(150, cluster.trafficWeight * 40)}
                pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.3, weight: 2, dashArray: '4 4' }}
            />
        ));
    };

    return (
        <>
            {/* The Actual Map Layers Rendered Here natively inside MapContainer context */}
            <LayerGroup>
                {renderRiskCircles()}
                {renderFloodPolygons()}
                {renderTrafficOverlays()}
            </LayerGroup>

            {/* The Floating UI Panel (Popover) */}
            {showIntelligenceLayers && !isCleanMode && (
                <div className="absolute top-[4.5rem] right-4 z-[var(--z-drawer)] bg-[#0a192f]/95 backdrop-blur-md border border-[#233554] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 w-64 text-slate-200 fade-scale-in origin-top-right pointer-events-auto">
                    <div className="flex items-center gap-2 border-b border-[#233554] pb-3 mb-3">
                        <Layers className="text-teal-400" size={18} />
                        <h3 className="font-semibold text-sm">Intelligence Layers</h3>
                    </div>

                    <div className="space-y-3">
                        <ToggleRow
                            label="High Risk Zones"
                            icon={<Activity size={14} className="text-red-400" />}
                            active={showHighRisk}
                            onClick={() => setShowHighRisk(!showHighRisk)}
                            activeColor="bg-red-500"
                        />
                        <ToggleRow
                            label="Medium Risk Zones"
                            icon={<AlertTriangle size={14} className="text-amber-400" />}
                            active={showMediumRisk}
                            onClick={() => setShowMediumRisk(!showMediumRisk)}
                            activeColor="bg-amber-500"
                        />
                        <ToggleRow
                            label="Stable Footprints"
                            icon={<Activity size={14} className="text-emerald-400" />}
                            active={showLowRisk}
                            onClick={() => setShowLowRisk(!showLowRisk)}
                            activeColor="bg-emerald-500"
                        />
                        <div className="h-px w-full bg-[#233554] my-2" />
                        <ToggleRow
                            label="Flood Simulation"
                            icon={<Droplets size={14} className="text-blue-400" />}
                            active={showFlood}
                            onClick={() => setShowFlood(!showFlood)}
                            activeColor="bg-blue-500"
                        />
                        <ToggleRow
                            label="Traffic Stress"
                            icon={<Car size={14} className="text-orange-400" />}
                            active={showTraffic}
                            onClick={() => setShowTraffic(!showTraffic)}
                            activeColor="bg-orange-500"
                        />
                    </div>
                </div>
            )}
        </>
    );
});

// Helper component for uniform toggles
function ToggleRow({ label, icon, active, onClick, activeColor }: { label: string, icon: React.ReactNode, active: boolean, onClick: () => void, activeColor: string }) {
    return (
        <div className="flex items-center justify-between group cursor-pointer" onClick={onClick}>
            <div className="flex items-center gap-2 text-xs text-slate-300 group-hover:text-white transition-colors">
                {icon}
                <span>{label}</span>
            </div>
            <div className={`w-8 h-4 rounded-full flex items-center transition-all px-0.5 ${active ? activeColor : 'bg-slate-700'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${active ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
        </div>
    );
}

export default AIOverlayPanel;
