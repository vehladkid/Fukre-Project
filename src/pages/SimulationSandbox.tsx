/**
 * SimulationSandbox.tsx — Full-screen Digital Twin Sandbox
 *
 * Lifecycle:
 *   1. MapToolbar "ENTER DIGITAL TWIN" navigates to /simulation with optional
 *      { zone, eventType, intensity } in location.state
 *   2. This page mounts → SandboxAssetLayer loads viewport assets (via useViewportAssets)
 *      and feeds them to both LODCanvasLayer (render) and SimulationContext (engine)
 *   3. SimulationControlPanel allows zone selection + ACTIVATE ENGINE click
 *   4. startSimulation() starts the RAF loop → clock, overlays, log all animate
 *   5. "Exit Sandbox" stops the engine and navigates back to /map
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer } from 'react-leaflet';
import { type LatLngExpression } from 'leaflet';
import { ArrowLeft, Activity, Cpu } from 'lucide-react';
import {
    SimulationProvider,
    useSimulation,
    type SimZone,
} from '../features/simulation/context/SimulationContext';
import { SimulationControlPanel } from '../features/simulation/components/SimulationControlPanel';
import { SimulationTimeline } from '../features/simulation/components/SimulationTimeline';
import { LiveIncidentLog } from '../features/simulation/components/LiveIncidentLog';
import { SimulationOverlayLayer } from '../features/simulation/components/SimulationOverlayLayer';
import { useViewportAssets } from '../features/map/useViewportAssets';
import { useLODAssets } from '../features/map/hooks/useLODAssets';
import { LODCanvasLayer } from '../features/map/components/LODCanvasLayer';
import { type MapAsset } from '../features/map/useMapAssets';
import { useZones } from '../features/simulation/hooks/useZones'; // Trigger Vite re-resolve

// ── SandboxAssetLayer — must live INSIDE <MapContainer> ───────────────────────
// Calls useViewportAssets (which calls useMap() internally),
// computes LOD points, renders the canvas layer, and reports assets upward.
function SandboxAssetLayer({
    onAssetsChange,
}: {
    onAssetsChange: (assets: MapAsset[], zoom: number) => void;
}) {
    const { viewportAssets, zoom } = useViewportAssets();
    const { lodPoints, mode } = useLODAssets(viewportAssets, zoom);
    const { zones } = useZones();

    // STEP 4 — VERIFY DATA ACCESS
    console.log('Sandbox Data Source Context =>', {
        zones: zones.length,
        viewportAssets: viewportAssets.length
    });

    // Bubble assets to parent so simulation engine can use them
    const onChangeRef = useRef(onAssetsChange);
    onChangeRef.current = onAssetsChange;

    useEffect(() => {
        onChangeRef.current(viewportAssets, zoom);
    }, [viewportAssets, zoom]);

    return (
        <LODCanvasLayer
            points={lodPoints}
            mode={mode}
            onClickAsset={() => { /* no-op in sandbox */ }}
        />
    );
}

// ── Clock HUD (top centre) ────────────────────────────────────────────────────
function SimulationClockHUD() {
    const { isActive, formattedTime, simTimeSeconds, playbackSpeed } = useSimulation();
    if (!isActive) return null;
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1500] pointer-events-none select-none">
            <div className="bg-[#0a192f]/95 backdrop-blur-md border border-red-500/40 rounded-xl px-6 py-3
                            shadow-[0_4px_32px_rgba(239,68,68,0.25)] flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-widest text-red-400">
                        DIGITAL TWIN ACTIVE
                    </span>
                </div>
                <div className="w-px h-5 bg-red-500/30" />
                <span className="text-xl font-mono font-bold text-white tracking-widest tabular-nums">
                    {formattedTime}
                </span>
                {playbackSpeed > 1 && (
                    <>
                        <div className="w-px h-5 bg-slate-700" />
                        <span className="text-xs font-bold text-blue-400">{playbackSpeed}x</span>
                    </>
                )}
                <div className="w-px h-5 bg-slate-700" />
                <div className="flex items-center gap-1 text-slate-500">
                    <Cpu size={11} />
                    <span className="text-[10px] font-mono">T+{simTimeSeconds}s</span>
                </div>
            </div>
        </div>
    );
}

// ── Inner — has access to SimulationContext ───────────────────────────────────
const SimulationSandboxInner = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { startSimulation, stopSimulation, setViewportAssets, isActive } = useSimulation();

    const hasBootedRef = useRef(false);
    const DELHI_CENTER: LatLngExpression = [28.6139, 77.2090];

    // Track viewport assets locally so we can show asset count
    const [assetCount, setAssetCount] = useState(0);

    // Called by SandboxAssetLayer every time viewport changes
    const handleAssetsChange = useCallback(
        (assets: MapAsset[], _zoom: number) => {
            setViewportAssets(assets);          // feed simulation engine
            setAssetCount(assets.length);
        },
        [setViewportAssets]
    );

    // Boot simulation engine once on mount if state was passed from MapView
    useEffect(() => {
        if (hasBootedRef.current) return;
        hasBootedRef.current = true;

        // Primary: React Router state. Fallback: sessionStorage (belt-and-suspenders)
        let state = location.state as {
            zone?: SimZone;
            eventType?: 'INFRASTRUCTURE_FAILURE' | 'FLASH_FLOOD';
            intensity?: number;
        } | null;

        if (!state?.zone) {
            try {
                const raw = sessionStorage.getItem('sim_launch_state');
                if (raw) {
                    state = JSON.parse(raw);
                    sessionStorage.removeItem('sim_launch_state');
                }
            } catch { /* ignore */ }
        }

        if (state?.zone && state?.eventType) {
            // Small delay so Leaflet panes initialize before engine starts
            const t = setTimeout(() => {
                startSimulation(state!.eventType!, state!.zone!, state!.intensity ?? 3);
            }, 600);
            return () => clearTimeout(t);
        }
        // No state → sandbox opens in standby. User configures in the panel.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Stop engine on unmount
    useEffect(() => () => { stopSimulation(); }, [stopSimulation]);

    return (
        <div
            className="h-screen w-screen bg-[#060d1a] text-slate-200 overflow-hidden relative"
            style={{ isolation: 'isolate' }}
        >
            {/* ── FULLSCREEN MAP ── */}
            <div className="absolute inset-0 z-0">
                <MapContainer
                    center={DELHI_CENTER}
                    zoom={13}
                    maxZoom={19}
                    minZoom={10}
                    scrollWheelZoom
                    preferCanvas
                    zoomControl={false}
                    style={{ height: '100%', width: '100%', background: '#060d1a' }}
                    className="z-0"
                >
                    <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
                        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                    />
                    {/* Infrastructure markers — same LOD system as MapView */}
                    <SandboxAssetLayer onAssetsChange={handleAssetsChange} />
                    {/* Simulation failure + propagation wave overlays */}
                    <SimulationOverlayLayer />
                </MapContainer>
            </div>

            {/* ── OVERLAY UI WRAPPER ── */}
            <div className="absolute inset-0 pointer-events-none z-[9999]">
                {/* ── TOP BAR ── */}
                <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none flex justify-between items-start">
                    <button
                        onClick={() => { stopSimulation(); navigate('/map'); }}
                        className="pointer-events-auto flex items-center gap-2 bg-[#112240]/90 backdrop-blur-md border
                                   border-[#233554] text-slate-300 hover:text-white px-4 py-2 rounded-lg shadow-lg
                                   hover:bg-[#233554] transition-colors text-sm"
                    >
                        <ArrowLeft size={15} />
                        Exit Sandbox
                    </button>

                    {/* Status pill */}
                    {!isActive ? (
                        <div className="pointer-events-none flex items-center gap-2 bg-[#112240]/90 backdrop-blur-md
                                        border border-[#233554] text-slate-400 px-4 py-2 rounded-lg text-xs">
                            <Activity size={13} />
                            Standby — select zone and activate in the panel →
                            {assetCount > 0 && (
                                <span className="ml-1 text-teal-400 font-mono">{assetCount} assets loaded</span>
                            )}
                        </div>
                    ) : (
                        <div className="pointer-events-none flex items-center gap-2 bg-red-500/10 backdrop-blur-md
                                        border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-xs">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            Simulation Running
                        </div>
                    )}
                </div>

                {/* ── CLOCK HUD ── */}
                <SimulationClockHUD />

                {/* ── LEFT — Live Incident Log ── */}
                <LiveIncidentLog />

                {/* ── RIGHT — Controls (Zone select / Pause / Speed / Shutdown) ── */}
                <SimulationControlPanel />

                {/* ── BOTTOM — Timeline ── */}
                <SimulationTimeline />
            </div>
        </div>
    );
};

// Wrap inner in its own SimulationProvider
const SimulationSandbox = () => (
    <SimulationProvider>
        <SimulationSandboxInner />
    </SimulationProvider>
);

export default SimulationSandbox;
