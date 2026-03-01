import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { supabase } from '../../lib/supabaseClient';
import { type MapAsset } from './useMapAssets';

// ─── Re-export MapAsset for convenience ────────────────────────────────────
export type { MapAsset } from './useMapAssets';

// ─── Columns from infrastructure_health_view ───────────────────────────────
const HEALTH_VIEW_SELECT = 'id,name,latitude,longitude,status_name,color_code,health_score,risk_level,last_inspected,severity_level';

// ─── Normalize row → MapAsset ──────────────────────────────────────────────
function normalizeHealthRow(item: any): MapAsset | null {
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

// ─── Spatial tile cache — survives full session ─────────────────────────────
// Key: "latMin_latMax_lngMin_lngMax_zoom"
const tileCache = new Map<string, MapAsset[]>();

function buildCacheKey(bounds: L.LatLngBounds, zoom: number): string {
    return [
        bounds.getSouth().toFixed(3),
        bounds.getNorth().toFixed(3),
        bounds.getWest().toFixed(3),
        bounds.getEast().toFixed(3),
        zoom.toFixed(0),
    ].join('_');
}

// ─── Adaptive fetch limit by zoom (Phase 8.1) ─────────────────────────────
function getAdaptiveLimit(zoom: number): number {
    if (zoom < 9) return 500;
    if (zoom < 13) return 1500;
    return 3000;
}

// ─── Delta threshold: only refetch when viewport changed meaningfully ───────
// Returns true if new bounds are "significantly different" from previous.
function isSignificantDelta(
    prev: L.LatLngBounds | null,
    next: L.LatLngBounds,
    prevZoom: number,
    nextZoom: number
): boolean {
    if (!prev) return true;
    if (Math.abs(nextZoom - prevZoom) >= 1) return true;

    const latSpan = Math.abs(prev.getNorth() - prev.getSouth());
    const lngSpan = Math.abs(prev.getEast() - prev.getWest());

    const latDelta = Math.abs(next.getCenter().lat - prev.getCenter().lat);
    const lngDelta = Math.abs(next.getCenter().lng - prev.getCenter().lng);

    // Trigger only if centre moved > 15% of the viewport span
    const latThreshold = latSpan * 0.15;
    const lngThreshold = lngSpan * 0.15;

    return latDelta > latThreshold || lngDelta > lngThreshold;
}

// ─── Hook ──────────────────────────────────────────────────────────────────
// Must be called inside a <MapContainer> child component.

export function useViewportAssets() {
    const map = useMap();

    // Stable asset registry — patch-in-place, never wholesale replace
    const assetRegistry = useRef<Map<string, MapAsset>>(new Map());

    // Derived state for consumers — only triggers re-render when registry changes
    const [viewportAssets, setViewportAssets] = useState<MapAsset[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState<number>(() => map.getZoom());

    // Tracking refs for delta, debounce, abort
    const prevBoundsRef = useRef<L.LatLngBounds | null>(null);
    const prevZoomRef = useRef<number>(map.getZoom());
    const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Flag to distinguish zoom velocity — pause fetching during rapid zoom
    const lastZoomTime = useRef<number>(Date.now());
    const zoomStabilizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Flush registry snapshot to React state ──────────────────────────────
    const flushRegistry = useCallback(() => {
        setViewportAssets(Array.from(assetRegistry.current.values()));
    }, []);

    // ── Patch or add a single asset into registry ───────────────────────────
    const patchAsset = useCallback((asset: MapAsset) => {
        assetRegistry.current.set(asset.id, asset);
        flushRegistry();
    }, [flushRegistry]);

    // ── Remove a single asset from registry ─────────────────────────────────
    const removeAsset = useCallback((id: string) => {
        if (assetRegistry.current.delete(id)) {
            flushRegistry();
        }
    }, [flushRegistry]);

    // ── Core fetch: bbox-filtered query, cache-first ─────────────────────────
    const fetchViewport = useCallback(async () => {
        const bounds = map.getBounds();
        const currentZoom = map.getZoom();

        // Delta guard — ignore micro-pans
        if (!isSignificantDelta(prevBoundsRef.current, bounds, prevZoomRef.current, currentZoom)) {
            return;
        }

        const cacheKey = buildCacheKey(bounds, currentZoom);

        // Cache hit — patch registry immediately, no network call
        if (tileCache.has(cacheKey)) {
            const cached = tileCache.get(cacheKey)!;
            cached.forEach(a => assetRegistry.current.set(a.id, a));
            flushRegistry();
            prevBoundsRef.current = bounds;
            prevZoomRef.current = currentZoom;
            return;
        }

        // Abort any in-flight request
        if (abortRef.current) {
            abortRef.current.abort();
        }
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);

        try {
            const limit = getAdaptiveLimit(currentZoom);

            const { data, error: fetchError } = await supabase
                .from('infrastructure_health_view')
                .select(HEALTH_VIEW_SELECT)
                .gte('latitude', bounds.getSouth())
                .lte('latitude', bounds.getNorth())
                .gte('longitude', bounds.getWest())
                .lte('longitude', bounds.getEast())
                .not('latitude', 'is', null)
                .not('longitude', 'is', null)
                .limit(limit);

            // If this request was aborted, do nothing
            if (controller.signal.aborted) return;

            if (fetchError) throw fetchError;

            const fresh: MapAsset[] = [];
            (data || []).forEach((item: any) => {
                const asset = normalizeHealthRow(item);
                if (asset) fresh.push(asset);
            });

            // REPLACE registry with only the current viewport's assets.
            // Accumulating stale entries from previous (wider) fetches causes
            // the visible count to be inflated. Realtime patches (patchAsset)
            // will re-add individual assets on top of this fresh baseline.
            assetRegistry.current.clear();
            fresh.forEach(a => assetRegistry.current.set(a.id, a));

            // Store in tile cache
            tileCache.set(cacheKey, fresh);
            // Cap cache size to prevent unbounded growth
            if (tileCache.size > 200) {
                const firstKey = tileCache.keys().next().value;
                if (firstKey) tileCache.delete(firstKey);
            }

            prevBoundsRef.current = bounds;
            prevZoomRef.current = currentZoom;
            flushRegistry();
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
            setError(err.message || 'Viewport fetch failed');
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
                abortRef.current = null;
            }
        }
    }, [map, flushRegistry]);

    // ── Debounced trigger (300ms) ────────────────────────────────────────────
    const scheduleFetch = useCallback(() => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(fetchViewport, 300);
    }, [fetchViewport]);

    // ── Zoom velocity — pause during rapid zoom ──────────────────────────────
    const handleZoomEnd = useCallback(() => {
        const now = Date.now();
        const timeSinceLast = now - lastZoomTime.current;
        lastZoomTime.current = now;
        setZoom(map.getZoom());

        if (zoomStabilizeTimer.current) clearTimeout(zoomStabilizeTimer.current);

        if (timeSinceLast < 300) {
            // Rapid zoom — wait for it to settle
            zoomStabilizeTimer.current = setTimeout(scheduleFetch, 500);
        } else {
            scheduleFetch();
        }
    }, [map, scheduleFetch]);

    // ── Map event listeners ──────────────────────────────────────────────────
    useEffect(() => {
        map.on('moveend', scheduleFetch);
        map.on('zoomend', handleZoomEnd);

        // Initial fetch
        fetchViewport();

        return () => {
            map.off('moveend', scheduleFetch);
            map.off('zoomend', handleZoomEnd);
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            if (zoomStabilizeTimer.current) clearTimeout(zoomStabilizeTimer.current);
            if (abortRef.current) abortRef.current.abort();
        };
    }, [map, scheduleFetch, handleZoomEnd, fetchViewport]);

    return {
        viewportAssets,
        loading,
        error,
        zoom,
        patchAsset,
        removeAsset,
    };
}
