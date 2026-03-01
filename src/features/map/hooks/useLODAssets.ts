import { useMemo } from 'react';
import { type MapAsset } from '../useMapAssets';

// ─── LOD Constants ──────────────────────────────────────────────────────────
const MAX_RENDER = 800;

// ─── LOD Modes ──────────────────────────────────────────────────────────────
export type LODMode = 'city' | 'district' | 'street';

export function getLODMode(zoom: number): LODMode {
    if (zoom < 9) return 'city';
    if (zoom < 13) return 'district';
    return 'street';
}

// ─── Render-ready point (what the canvas layer actually draws) ──────────────
export interface LODPoint {
    lat: number;
    lng: number;
    color: string;
    radius: number;
    count: number;       // 1 for individual, N for aggregate
    label?: string;      // shown on aggregate clusters
    id: string;          // stable key (asset id or grid cell key)
    opacity: number;
}

// ─── Zoom → marker radius (canvas circles) ──────────────────────────────────
function getRadius(zoom: number, isAggregate: boolean): number {
    const r = Math.min(10, Math.max(3, 2 + zoom * 0.4));
    return isAggregate ? r + 2 : r;
}

// ─── Status → color ─────────────────────────────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
    OPERATIONAL: '#22c55e',
    MAINTENANCE: '#f59e0b',
    UNDER_REPAIR: '#f97316',
    CRITICAL: '#ef4444',
};
const RISK_PRIORITY = ['CRITICAL', 'UNDER_REPAIR', 'MAINTENANCE', 'OPERATIONAL'] as const;

function resolveColor(asset: MapAsset): string {
    const key = asset.status_name.toUpperCase().replace(/\s+/g, '_');
    return STATUS_COLORS[key] ?? asset.color_code ?? '#64748b';
}

function dominantColor(assets: MapAsset[]): string {
    const keys = new Set(assets.map(a => a.status_name.toUpperCase().replace(/\s+/g, '_')));
    for (const risk of RISK_PRIORITY) {
        if (keys.has(risk)) return STATUS_COLORS[risk];
    }
    return assets[0] ? resolveColor(assets[0]) : '#64748b';
}

// ─── CITY MODE: Grid Aggregation ────────────────────────────────────────────
// Divides viewport into a coarse grid, one dot per cell showing count.
// Target: 20–60 visual points maximum.

function gridAggregate(assets: MapAsset[], zoom: number): LODPoint[] {
    // Grid resolution: fewer cells = fewer dots
    // At zoom 6-8: ~4–6 degree cells
    const cellDeg = zoom < 7 ? 4 : zoom < 8 ? 2 : 1;

    const cells = new Map<string, MapAsset[]>();
    assets.forEach(a => {
        const cellLat = Math.floor(a.latitude / cellDeg) * cellDeg;
        const cellLng = Math.floor(a.longitude / cellDeg) * cellDeg;
        const key = `${cellLat}_${cellLng}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key)!.push(a);
    });

    const points: LODPoint[] = [];
    cells.forEach((bucket, key) => {
        // Place dot at average centre of bucket
        const lat = bucket.reduce((s, a) => s + a.latitude, 0) / bucket.length;
        const lng = bucket.reduce((s, a) => s + a.longitude, 0) / bucket.length;

        points.push({
            id: `grid_${key}`,
            lat,
            lng,
            color: dominantColor(bucket),
            radius: Math.min(14, Math.max(6, 4 + Math.log2(bucket.length + 1) * 2)),
            count: bucket.length,
            label: bucket.length > 1 ? String(bucket.length) : undefined,
            opacity: 0.85,
        });
    });

    return points;
}

// ─── DISTRICT MODE: Radius Clustering ───────────────────────────────────────
// Simple radius grouping — roughly 100–400 visible markers.
// Greedy nearest-first: iterate, assign to existing cluster if within threshold.

function radiusCluster(assets: MapAsset[], zoom: number): LODPoint[] {
    // ~0.3° at zoom 9 down to ~0.05° at zoom 12
    const thresholdDeg = Math.max(0.05, 0.7 / Math.pow(2, zoom - 8));

    const clusters: { lat: number; lng: number; assets: MapAsset[] }[] = [];

    assets.forEach(a => {
        let assigned = false;
        for (const c of clusters) {
            const dLat = Math.abs(a.latitude - c.lat);
            const dLng = Math.abs(a.longitude - c.lng);
            if (dLat < thresholdDeg && dLng < thresholdDeg) {
                c.assets.push(a);
                // Update centroid incrementally
                const n = c.assets.length;
                c.lat = c.lat + (a.latitude - c.lat) / n;
                c.lng = c.lng + (a.longitude - c.lng) / n;
                assigned = true;
                break;
            }
        }
        if (!assigned) {
            clusters.push({ lat: a.latitude, lng: a.longitude, assets: [a] });
        }
    });

    // Downsample if still >800
    const capped = clusters.length > MAX_RENDER
        ? evenSample(clusters, MAX_RENDER)
        : clusters;

    return capped.map((c, i) => ({
        id: `cluster_${i}`,
        lat: c.lat,
        lng: c.lng,
        color: dominantColor(c.assets),
        radius: getRadius(zoom, c.assets.length > 1),
        count: c.assets.length,
        label: c.assets.length > 1 ? String(c.assets.length) : undefined,
        opacity: 0.9,
    }));
}

// ─── STREET MODE: Individual assets, hard 800 cap ───────────────────────────

function streetLevel(assets: MapAsset[], zoom: number): LODPoint[] {
    const capped = assets.length > MAX_RENDER
        ? evenSample(assets, MAX_RENDER)
        : assets;

    return capped.map(a => ({
        id: a.id,
        lat: a.latitude,
        lng: a.longitude,
        color: resolveColor(a),
        radius: getRadius(zoom, false),
        count: 1,
        opacity: 1,
    }));
}

// ─── Even sampling (preserves spatial spread) ───────────────────────────────
function evenSample<T>(arr: T[], n: number): T[] {
    if (arr.length <= n) return arr;
    const step = arr.length / n;
    const result: T[] = [];
    for (let i = 0; i < n; i++) {
        result.push(arr[Math.floor(i * step)]);
    }
    return result;
}

// ─── Main LOD hook ──────────────────────────────────────────────────────────
// Pure transformation — no side effects, no network calls.
// Takes viewport assets + zoom, returns render-ready points.

export function useLODAssets(assets: MapAsset[], zoom: number): {
    lodPoints: LODPoint[];
    mode: LODMode;
    renderCount: number;
} {
    const mode = getLODMode(zoom);

    const lodPoints = useMemo(() => {
        if (!assets.length) return [];

        let points: LODPoint[];

        switch (mode) {
            case 'city':
                points = gridAggregate(assets, zoom);
                break;
            case 'district':
                points = radiusCluster(assets, zoom);
                break;
            case 'street':
            default:
                points = streetLevel(assets, zoom);
                break;
        }

        // Final safety guard — should never trigger but prevents freezes
        if (points.length > MAX_RENDER) {
            return evenSample(points, MAX_RENDER);
        }

        return points;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assets, zoom, mode]);

    return {
        lodPoints,
        mode,
        renderCount: lodPoints.length,
    };
}
