import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { Marker, Popup } from 'react-leaflet';
import { type MapAsset } from '../useMapAssets';
import { useAuth } from '../../../context/AuthContext';

// ─── Status → color mapping ─────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
    OPERATIONAL: '#22c55e',
    MAINTENANCE: '#f59e0b',
    UNDER_REPAIR: '#f97316',
    CRITICAL: '#ef4444',
};

// ─── Color code → approximate status key ───────────────────────────────────
// Used to determine dominant risk in cluster icon.
// Priority: CRITICAL > UNDER_REPAIR > MAINTENANCE > OPERATIONAL
const RISK_PRIORITY = ['CRITICAL', 'UNDER_REPAIR', 'MAINTENANCE', 'OPERATIONAL'];

function getDominantColor(assets: MapAsset[]): string {
    // Try to find the highest-priority status present
    const statusNames = new Set(assets.map(a => a.status_name.toUpperCase().replace(/\s+/g, '_')));
    for (const risk of RISK_PRIORITY) {
        if (statusNames.has(risk)) return STATUS_COLORS[risk];
    }
    // Fallback: find by color code majority
    for (const risk of RISK_PRIORITY) {
        const color = STATUS_COLORS[risk];
        if (assets.some(a => a.color_code === color)) return color;
    }
    return '#64748b'; // slate fallback
}

// ─── Custom cluster icon factory ────────────────────────────────────────────
// cluster typed as `any` — MarkerCluster is not exported by @types/leaflet;
// it lives in the leaflet.markercluster ambient types which we don't install.
function createClusterCustomIcon(cluster: any): L.DivIcon {
    const count = cluster.getChildCount() as number;
    const markers = cluster.getAllChildMarkers() as L.Marker[];

    // Extract assets from marker options (we store them as a custom _asset property)
    const assets: MapAsset[] = markers
        .map((m: L.Marker) => (m.options as any)._asset as MapAsset)
        .filter(Boolean);

    const dominantColor = getDominantColor(assets);

    // Size tier
    const size = count < 10 ? 38 : count < 100 ? 46 : 54;
    const fontSize = count < 10 ? 13 : count < 100 ? 12 : 11;

    return L.divIcon({
        html: `
            <div class="cluster-icon" style="
                width: ${size}px;
                height: ${size}px;
                background: radial-gradient(circle, ${dominantColor}33 0%, ${dominantColor}18 70%);
                border: 2px solid ${dominantColor};
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 0 12px ${dominantColor}66, inset 0 0 8px ${dominantColor}22;
                backdrop-filter: blur(4px);
                transition: transform 0.2s ease;
            ">
                <span style="
                    color: ${dominantColor};
                    font-size: ${fontSize}px;
                    font-weight: 700;
                    font-family: 'Inter', monospace;
                    letter-spacing: -0.5px;
                    text-shadow: 0 0 8px ${dominantColor};
                ">${count}</span>
            </div>
        `,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

// ─── Zoom → cluster radius ──────────────────────────────────────────────────
function getClusterRadius(zoom: number): number {
    if (zoom < 9) return 120;
    if (zoom < 12) return 80;
    if (zoom < 14) return 50;
    return 30;
}

// ─── Status-aware marker divIcon ────────────────────────────────────────────
function createAssetMarkerIcon(asset: MapAsset, zoom: number): L.DivIcon {
    const rawStatus = asset.status_name.toUpperCase().replace(/\s+/g, '_');
    const color = STATUS_COLORS[rawStatus] ?? asset.color_code ?? '#64748b';
    const radius = Math.min(14, Math.max(6, 4 + zoom * 0.6));
    const size = radius * 2;

    let cssClass = 'marker-operational';
    if (rawStatus === 'CRITICAL') cssClass = 'marker-critical';
    else if (rawStatus === 'UNDER_REPAIR') cssClass = 'marker-under-repair';
    else if (rawStatus === 'MAINTENANCE') cssClass = 'marker-maintenance';

    return L.divIcon({
        html: `<div class="${cssClass}" style="
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background-color: ${color};
            border: 2px solid ${color};
            box-shadow: 0 0 ${radius}px ${color}88;
        "></div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    });
}

// ─── Popup content builder ─────────────────────────────────────────────────
function buildPopupContent(asset: MapAsset): string {
    const color = asset.color_code;
    const riskColor =
        asset.risk_level === 'HIGH' ? '#ef4444' :
            asset.risk_level === 'MEDIUM' ? '#f59e0b' : '#10b981';
    return `
        <div class="bg-[#112240] border border-[#233554] rounded-xl overflow-hidden w-64">
            <div class="h-2 w-full" style="background-color: ${color}"></div>
            <div class="p-4 space-y-3">
                <div>
                    <h3 class="font-bold text-white text-lg leading-tight mb-1">${asset.name}</h3>
                    <div class="flex items-center gap-1.5 text-slate-400 text-sm font-medium">
                        <span style="color:#4cd6b8">📍</span>
                        <span>${asset.status_name}</span>
                    </div>
                </div>
                <div class="space-y-2 pt-2 border-t border-[#233554]">
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-slate-500">Risk Level:</span>
                        <span class="font-bold font-mono text-xs" style="color:${riskColor}">${asset.risk_level}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm">
                        <span class="text-slate-500">Health Score:</span>
                        <span class="text-slate-300 font-mono text-xs">${asset.health_score}/100</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ─── Props ─────────────────────────────────────────────────────────────────
interface AssetClusterLayerProps {
    assets: MapAsset[];
    zoom: number;
    onSelectHistory: (id: string) => void;
}

// ─── Main cluster component ─────────────────────────────────────────────────
// Wrapped in React.memo — only re-renders when assets array reference changes.
const AssetClusterLayer = React.memo(({ assets, zoom, onSelectHistory }: AssetClusterLayerProps) => {
    const { role } = useAuth();
    const canSeeDetails = role === 'admin' || role === 'operator';
    const isAdmin = role === 'admin';
    const clusterRadius = getClusterRadius(zoom);
    const disableAt = zoom >= 14 ? 14 : undefined;

    // Stable callback ref
    const onSelectRef = useRef(onSelectHistory);
    useEffect(() => { onSelectRef.current = onSelectHistory; }, [onSelectHistory]);

    // Memoize markers to prevent unnecessary reconstruction
    const markers = useMemo(() => {
        return assets.map(asset => {
            const icon = createAssetMarkerIcon(asset, zoom);
            // Attach asset data to icon options for cluster icon factory access
            const markerOptions: L.MarkerOptions & { _asset: MapAsset } = {
                icon,
                _asset: asset,
            };
            return { asset, icon: markerOptions };
        });
    }, [assets, zoom]);

    return (
        <MarkerClusterGroup
            key={`cluster-${clusterRadius}`}
            chunkedLoading
            spiderfyOnMaxZoom
            showCoverageOnHover={false}
            maxClusterRadius={clusterRadius}
            disableClusteringAtZoom={disableAt}
            iconCreateFunction={createClusterCustomIcon}
            animate
        >
            {markers.map(({ asset, icon }) => (
                <Marker
                    key={asset.id}
                    position={[asset.latitude, asset.longitude]}
                    icon={icon.icon}
                    eventHandlers={isAdmin ? {
                        click: () => onSelectRef.current(asset.id),
                    } : undefined}
                >
                    {canSeeDetails && (
                        <Popup
                            className="custom-popup border-0 p-0 m-0 rounded-xl overflow-hidden shadow-2xl"
                            closeButton={false}
                        >
                            <div dangerouslySetInnerHTML={{ __html: buildPopupContent(asset) }} />
                        </Popup>
                    )}
                </Marker>
            ))}
        </MarkerClusterGroup>
    );
});

AssetClusterLayer.displayName = 'AssetClusterLayer';

export default AssetClusterLayer;
