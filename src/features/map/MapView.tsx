import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { latLngBounds, type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, MapPinOff } from 'lucide-react';
import { type MapAsset } from './useMapAssets';
import { useViewportAssets } from './useViewportAssets';
import { useLODAssets } from './hooks/useLODAssets';
import { useTopologyCount } from './useTopologyCount';
import { useOutletContext } from 'react-router-dom';
import { type DashboardContextType } from '../../components/layout/DashboardLayout';
import LODCanvasLayer from './components/LODCanvasLayer';
import { supabase } from '../../lib/supabaseClient';
import { useAIPredictions } from '../ai/hooks/useAIPredictions';
import AIOverlayPanel from '../ai/components/AIOverlayPanel';
import AIInsightCard from '../ai/components/AIInsightCard';
import { useMapUIState } from './hooks/useMapUIState';
import MapToolbar from './components/MapToolbar';
import TopologyPanel from './components/TopologyPanel';
import { useSimulation } from '../simulation/context/SimulationContext';
import { SimulationControlPanel } from '../simulation/components/SimulationControlPanel';

// ─── Columns needed for realtime single-row patches ─────────────────────────
const HEALTH_VIEW_SELECT = 'id,name,latitude,longitude,status_name,color_code,health_score,risk_level,last_inspected,severity_level';

// eslint-disable-next-line react-refresh/only-export-components, @typescript-eslint/no-explicit-any
function normalizeRow(item: any): MapAsset | null {
    if (!item.latitude || !item.longitude) return null;
    return {
        id: item.id,
        name: item.name,
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        status_name: item.status_name ?? 'Unknown',
        color_code: item.color_code ?? '#94a3b8',
        health_score: item.health_score ?? 50,
        risk_level: item.risk_level ?? 'MEDIUM',
        last_inspected: item.last_inspected || null,
        severity_level: Number(item.severity_level) || 0,
    };
}

// ─── Initial bounds fitter — fires ONCE on first load ────────────────────────
function BoundsUpdater({ assets }: { assets: MapAsset[] }) {
    const map = useMap();
    const hasFitted = useRef(false);
    useEffect(() => {
        if (hasFitted.current || !assets.length) return;
        const bounds = latLngBounds(assets.map(a => [a.latitude, a.longitude]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        hasFitted.current = true;
    }, [assets, map]);
    return null;
}

// ─── MapController — lives INSIDE MapContainer ───────────────────────────────
// All viewport + LOD + realtime logic lives here (needs useMap()).
// Communicates to parent via stable callback refs.

interface MapControllerProps {
    onSelectHistory: (id: string) => void;
    onAssetsChange: (
        viewportAssets: MapAsset[],
        loading: boolean,
        error: string | null,
        zoom: number
    ) => void;
}

function MapController({ onSelectHistory, onAssetsChange }: MapControllerProps) {
    const {
        viewportAssets,
        loading,
        error,
        zoom,
        patchAsset,
        removeAsset,
    } = useViewportAssets();

    const { triggerInteraction } = useMapUIState();
    useMapEvents({
        dragstart: triggerInteraction,
        zoomstart: triggerInteraction,
    });

    // LOD transformation — pure, no network calls
    const { lodPoints, mode } = useLODAssets(viewportAssets, zoom);

    // Propagate state to parent (crosses MapContainer boundary)
    const onAssetsRef = useRef(onAssetsChange);
    useEffect(() => { onAssetsRef.current = onAssetsChange; }, [onAssetsChange]);
    useEffect(() => {
        onAssetsRef.current(viewportAssets, loading, error, zoom);
    }, [viewportAssets, loading, error, zoom]);

    // ── Realtime diff-patch ──────────────────────────────────────────────────
    useEffect(() => {
        const channel = supabase
            .channel('infra-assets-lod-live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'infrastructure_assets' },
                async (payload) => {
                    if (payload.eventType === 'DELETE') {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const deletedId = (payload.old as any)?.id;
                        if (deletedId) removeAsset(deletedId);
                        return;
                    }
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const assetId = (payload.new as any)?.id;
                    if (!assetId) return;
                    const { data, error: fetchErr } = await supabase
                        .from('infrastructure_health_view')
                        .select(HEALTH_VIEW_SELECT)
                        .eq('id', assetId)
                        .single();
                    if (fetchErr || !data) return;
                    const asset = normalizeRow(data);
                    if (asset) patchAsset(asset);
                }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [patchAsset, removeAsset]);

    const handleClickAsset = useRef(onSelectHistory);
    useEffect(() => { handleClickAsset.current = onSelectHistory; }, [onSelectHistory]);

    return (
        <>
            <BoundsUpdater assets={viewportAssets} />
            <LODCanvasLayer
                points={lodPoints}
                mode={mode}
                onClickAsset={(id) => handleClickAsset.current(id)}
            />
        </>
    );
}

// ─── Topology Item ────────────────────────────────────────────────────────────
const TopologyItem = React.memo(({ label, count, color }: {
    label: string; count: number; color: string;
}) => (
    <div className="flex items-center justify-between text-xs text-slate-300">
        <span className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
            {label}
        </span>
        <span className="font-mono bg-[#0a192f] border border-[#233554] px-1.5 py-0.5 rounded">
            {count.toLocaleString()}
        </span>
    </div>
));
TopologyItem.displayName = 'TopologyItem';

// ─── Main MapView Inner ─────────────────────────────────────────────────────────────
const MapViewInner = () => {
    const defaultCenter = [28.6139, 77.2090] as LatLngExpression;
    const { requestAssetHistory } = useOutletContext<DashboardContextType>();

    // ── Cross-boundary state from MapController ──────────────────────────────
    const [viewportAssets, setViewportAssets] = React.useState<MapAsset[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [zoom, setZoom] = React.useState(13);

    const handleAssetsChange = React.useCallback(
        (assets: MapAsset[], isLoading: boolean, err: string | null, z: number) => {
            setViewportAssets(assets);
            setLoading(isLoading);
            setError(err);
            setZoom(z);
        },
        []
    );

    const { setViewportAssets: syncSimulationAssets } = useSimulation();

    // Push new viewport assets reliably to the Simulation Engine context
    React.useEffect(() => {
        syncSimulationAssets(viewportAssets);
    }, [viewportAssets, syncSimulationAssets]);

    // ── Topology — total DB counts (NOT viewport) ────────────────────────────
    // Shows true ~3000 mapped assets at all times.
    const { total: totalAssets } = useTopologyCount();


    // ── Rendered count (LOD points) — computed from viewport assets ──────────
    // We trigger useLODAssets purely for the render side-effect in MapController
    // but we can just let MapController handle it. We don't need renderCount here.

    // ── Phase 9: AI Predictive Intelligence ────────────────────────────────
    const { predictions, riskClusters, densityClusters, trafficClusters } = useAIPredictions(viewportAssets, zoom);

    const { isCleanMode } = useMapUIState();

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
            {!isCleanMode && (
                <div className="flex justify-between items-center fade-scale-in">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Geospatial Intelligence</h1>
                        <p className="text-slate-400">
                            Level-of-Detail asset visualization
                            {totalAssets > 0 && (
                                <span className="ml-2 text-teal-400 font-mono">
                                    — {totalAssets.toLocaleString()} mapped assets
                                </span>
                            )}
                        </p>
                    </div>
                </div>
            )}

            {/* Map wrapper — strictly relative, no padding resize */}
            <div className="flex-1 rounded-2xl overflow-hidden border border-[#233554] relative z-0 shadow-2xl bg-[#0a192f] transition-all duration-300">

                {/* ── Phase 9.3: Absolute MapOverlayRoot ── */}
                <div className="absolute inset-0 pointer-events-none z-[9999] flex">
                    <MapToolbar />

                    {/* ── Phase 9: Predictive Intelligence Cards (Docked) ── */}
                    <AIInsightCard predictions={predictions} />

                    {/* ── Floating Topology Panel (Docked) ── */}
                    <TopologyPanel zoom={zoom} />
                </div>

                {/* ── Phase 10: Digital Twin Control Panel ──
                     Portals itself to document.body, so location in DOM here doesn't matter much,
                     but we keep it as a logical child of MapView. */}
                <SimulationControlPanel />

                {/* Live indicator (LOD feed) */}
                <div className="absolute bottom-5 left-5 z-[1050] pointer-events-none">
                    <div className="bg-[#112240]/90 px-4 py-2 flex items-center gap-2 rounded-lg border border-[#233554] shadow-xl pointer-events-auto">
                        <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                        <span className="text-xs text-slate-300 font-medium">LOD Live Feed</span>
                        {loading && viewportAssets.length > 0 && (
                            <Loader2 className="animate-spin text-teal-400 h-3 w-3 ml-1" />
                        )}
                    </div>
                </div>

                {/* Initial loading overlay */}
                {loading && viewportAssets.length === 0 && (
                    <div className="absolute inset-0 z-[1000] bg-[#0a192f]/85 flex flex-col items-center justify-center pointer-events-auto">
                        <Loader2 className="animate-spin text-teal-400 mb-4 h-12 w-12" />
                        <p className="text-slate-300 font-medium text-lg">Initialising LOD engine...</p>
                        <p className="text-slate-500 text-sm mt-1">Loading {totalAssets > 0 ? totalAssets.toLocaleString() : '—'} infrastructure assets</p>
                    </div>
                )}

                {/* Subtle viewport-update indicator */}
                {loading && viewportAssets.length > 0 && (
                    <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#112240]/90 border border-[#233554] rounded-lg shadow-lg">
                            <Loader2 className="animate-spin text-teal-400 h-3.5 w-3.5" />
                            <span className="text-slate-400 text-xs">Updating viewport...</span>
                        </div>
                    </div>
                )}

                {error && !loading && (
                    <div className="absolute inset-0 z-[1000] bg-red-900/10 flex flex-col items-center justify-center p-6 text-center pointer-events-auto">
                        <div className="bg-[#112240] border border-red-500/50 p-6 rounded-2xl max-w-md shadow-2xl">
                            <MapPinOff className="text-red-400 h-16 w-16 mx-auto mb-4 opacity-80" />
                            <h3 className="text-white text-xl font-bold mb-2">Map Feed Error</h3>
                            <p className="text-slate-400 mb-4">{error}</p>
                            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-red-500 hover:bg-red-400 text-white font-bold rounded-lg transition-colors">
                                Reload Map
                            </button>
                        </div>
                    </div>
                )}

                {!loading && !error && viewportAssets.length === 0 && (
                    <div className="absolute inset-0 z-[1000] pointer-events-none flex flex-col items-center justify-center">
                        <div className="bg-[#112240]/80 border border-[#233554] p-6 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-xs pointer-events-auto">
                            <MapPinOff className="text-slate-500 h-12 w-12 mb-3" />
                            <p className="text-slate-300 font-bold mb-1">No Assets in Viewport</p>
                            <p className="text-slate-500 text-sm">Pan or zoom out to find infrastructure assets.</p>
                        </div>
                    </div>
                )}

                {/* ── Leaflet map — canvas mode ── */}
                <MapContainer
                    center={defaultCenter}
                    zoom={13}
                    scrollWheelZoom
                    preferCanvas
                    style={{ height: '100%', width: '100%', background: '#0a192f' }}
                    className="z-0"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                    />
                    <MapController
                        onSelectHistory={requestAssetHistory}
                        onAssetsChange={handleAssetsChange}
                    />

                    {/* ── Phase 9: Predictive Intelligence Overlays ── */}
                    <AIOverlayPanel
                        riskClusters={riskClusters}
                        densityClusters={densityClusters}
                        trafficClusters={trafficClusters}
                    />
                </MapContainer>
            </div>
        </div>
    );
};


const MapView = () => {
    return <MapViewInner />;
};

export default React.memo(MapView);
