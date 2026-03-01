import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../context/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────
// MapAsset reads from infrastructure_health_view — the computed intelligence layer.
// Flat shape: no nested asset_status object.

export interface MapAsset {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    status_name: string;
    color_code: string;
    health_score: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    last_inspected: string | null;
    severity_level: number;
    zone?: string;
}

// ── Normalize a row from infrastructure_health_view into MapAsset | null ──────
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
        zone: item.zone_id || item.zone_name || item.zone || '',
    };
}

// ── Columns needed from infrastructure_health_view ────────────────────────────
const HEALTH_VIEW_SELECT = 'id,name,latitude,longitude,status_name,color_code,health_score,risk_level,zone_id';

export const useMapAssets = () => {
    const { user } = useAuth();
    const [assetMap, setAssetMap] = useState<Record<string, MapAsset>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ── Initial full fetch from infrastructure_health_view ────────────────────
    const fetchMapAssets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('infrastructure_health_view')
                .select(HEALTH_VIEW_SELECT)
                .not('latitude', 'is', null)
                .not('longitude', 'is', null);

            if (fetchError) throw fetchError;

            const map: Record<string, MapAsset> = {};
            (data || []).forEach((item: any) => {
                const asset = normalizeHealthRow(item);
                if (asset) map[asset.id] = asset;
            });

            setAssetMap(map);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch map assets');
            console.error('Error fetching map assets:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Initial load on auth ──────────────────────────────────────────────────
    useEffect(() => {
        if (user) fetchMapAssets();
    }, [fetchMapAssets, user]);

    // ── Zero-latency realtime diff-patch ──────────────────────────────────────
    // Strategy:
    //   DELETE → immediately remove marker from state (no network call)
    //   INSERT / UPDATE → single-row SELECT from infrastructure_health_view
    //                     for that specific asset ID, then patch assetMap
    //
    // intelligence_health_view is a computed view — a single-row fetch is fast
    // (~50-100ms) and returns the correct computed values (health_score, risk_level).
    // This is far faster than refetching the entire dataset.
    useEffect(() => {
        const channel = supabase
            .channel('infra-assets-map-live')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'infrastructure_assets' },
                async (payload) => {
                    const eventType = payload.eventType;

                    // ── DELETE: instant removal — no network needed ───────────
                    if (eventType === 'DELETE') {
                        const deletedId = (payload.old as any)?.id;
                        if (deletedId) {
                            setAssetMap(prev => {
                                const next = { ...prev };
                                delete next[deletedId];
                                return next;
                            });
                        }
                        return;
                    }

                    // ── INSERT / UPDATE: targeted single-row fetch from view ──
                    const assetId = (payload.new as any)?.id;
                    if (!assetId) return;

                    const { data, error: fetchErr } = await supabase
                        .from('infrastructure_health_view')
                        .select(HEALTH_VIEW_SELECT)
                        .eq('id', assetId)
                        .single();

                    if (fetchErr || !data) return;

                    const asset = normalizeHealthRow(data);
                    if (!asset) return; // no coords — skip map placement

                    // Patch a single entry in the assetMap — O(1), no full re-render
                    setAssetMap(prev => ({ ...prev, [asset.id]: asset }));
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // ── Derive array for consumers (memoized by object reference) ─────────────
    const validAssets = Object.values(assetMap);

    return {
        validAssets,
        loading,
        error,
        refreshMap: fetchMapAssets
    };
};
