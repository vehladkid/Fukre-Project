import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import {
    registerRefreshCallback, deregisterRefreshCallback,
    registerOptimisticCallback, deregisterOptimisticCallback,
    type RealtimePayload,
} from '../../lib/intelligenceRefresh';

// ─── Types matching the DB views ──────────────────────────────────────────────

export interface StatusDistributionRow {
    status_id: string;
    status_name: string;
    color_code: string;
    severity_level: number;
    asset_count: number;
}

export interface ZoneDistributionRow {
    zone_id: string;
    zone_name: string;
    asset_count: number;
    at_risk_count: number;
}

export interface CategoryMaintenanceRow {
    category_id: string;
    category_name: string;
    total_assets: number;
    maintenance_count: number;
    critical_count: number;
}

// ─── Derived KPIs — computed from statusDistribution ─────────────────────────
export interface DerivedKpis {
    total_assets: number;
    at_risk_total: number;
    statusCounts: Record<string, number>;
}

export interface InfrastructureAnalytics {
    kpis: DerivedKpis;
    statusDistribution: StatusDistributionRow[];
    zoneDistribution: ZoneDistributionRow[];
    categoryMaintenance: CategoryMaintenanceRow[];
}

const EMPTY_ANALYTICS: InfrastructureAnalytics = {
    kpis: { total_assets: 0, at_risk_total: 0, statusCounts: {} },
    statusDistribution: [],
    zoneDistribution: [],
    categoryMaintenance: [],
};

// ─── Derive KPIs from statusDistribution — SINGLE SOURCE OF TRUTH ────────────
export function deriveKpis(statusDistribution: StatusDistributionRow[]): DerivedKpis {
    const statusCounts: Record<string, number> = {};
    let total_assets = 0;
    let at_risk_total = 0;

    statusDistribution.forEach(row => {
        const count = Number(row.asset_count);
        statusCounts[row.status_name] = count;
        total_assets += count;
        if (row.severity_level >= 3) {
            at_risk_total += count;
        }
    });

    return { total_assets, at_risk_total, statusCounts };
}

// ─── Module-level cache — survives re-renders, cleared on revalidation ────────
let sessionCache: InfrastructureAnalytics | null = null;
let cacheLoadedAt: number | null = null;
// TTL = 0 means cache is never served on remount — always fetch fresh.
// The cache is used only as an optimistic state store for realtime mutations.
const CACHE_TTL_MS = 0;

function isCacheValid(): boolean {
    if (!sessionCache || !cacheLoadedAt) return false;
    return Date.now() - cacheLoadedAt < CACHE_TTL_MS;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useInfrastructureAnalytics = () => {
    const [analytics, setAnalytics] = useState<InfrastructureAnalytics>(EMPTY_ANALYTICS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalytics = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && isCacheValid()) {
            setAnalytics(sessionCache!);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [statusRes, zoneRes, categoryRes] = await Promise.all([
                supabase.from('analytics_status_distribution').select('*'),
                supabase.from('analytics_zone_distribution').select('*'),
                supabase.from('analytics_category_maintenance').select('*'),
            ]);

            if (statusRes.error) throw statusRes.error;
            if (zoneRes.error) throw zoneRes.error;
            if (categoryRes.error) throw categoryRes.error;

            const statusDistribution = (statusRes.data ?? []) as StatusDistributionRow[];

            const result: InfrastructureAnalytics = {
                kpis: deriveKpis(statusDistribution),
                statusDistribution,
                zoneDistribution: (zoneRes.data ?? []) as ZoneDistributionRow[],
                categoryMaintenance: (categoryRes.data ?? []) as CategoryMaintenanceRow[],
            };

            sessionCache = result;
            cacheLoadedAt = Date.now();
            setAnalytics(result);
        } catch (err: any) {
            console.error('Analytics fetch error:', err);
            setError(err.message || 'Failed to load analytics');
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Initial fetch on mount ────────────────────────────────────────────────
    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    // ── Manual refresh (refresh button) ──────────────────────────────────────
    const refreshAnalytics = useCallback(() => {
        sessionCache = null;
        cacheLoadedAt = null;
        fetchAnalytics(true);
    }, [fetchAnalytics]);

    // ── Bus 1: Optimistic update — instant, no loading state ─────────────────
    // Strategy: immediately mutate sessionCache.statusDistribution counts based
    // on the realtime event (INSERT/UPDATE/DELETE) and call setAnalytics().
    // This makes KPI cards and pie chart update BEFORE the network refetch.
    useEffect(() => {
        const key = 'analytics-optimistic';

        registerOptimisticCallback(key, (payload: RealtimePayload) => {
            // Can't optimistically update if we have no cache to mutate yet
            if (!sessionCache) return;

            const { eventType, new: newRow, old: oldRow } = payload;

            // ── Mutate statusDistribution counts ──────────────────────────────
            const updatedStatus = sessionCache.statusDistribution.map(s => {
                let count = Number(s.asset_count);
                if (eventType === 'INSERT' && s.status_id === newRow.status_id) {
                    count += 1;
                } else if (eventType === 'DELETE' && s.status_id === oldRow.status_id) {
                    count -= 1;
                } else if (eventType === 'UPDATE') {
                    // Status may have changed — adjust both old and new buckets
                    if (s.status_id === oldRow.status_id) count -= 1;
                    if (s.status_id === newRow.status_id) count += 1;
                }
                return { ...s, asset_count: Math.max(0, count) };
            });

            // ── Mutate zoneDistribution counts ────────────────────────────────
            const updatedZones = sessionCache.zoneDistribution.map(z => {
                let assetCount = Number(z.asset_count);
                if (eventType === 'INSERT' && z.zone_id === newRow.zone_id) {
                    assetCount += 1;
                } else if (eventType === 'DELETE' && z.zone_id === oldRow.zone_id) {
                    assetCount -= 1;
                } else if (eventType === 'UPDATE' && oldRow.zone_id !== newRow.zone_id) {
                    if (z.zone_id === oldRow.zone_id) assetCount -= 1;
                    if (z.zone_id === newRow.zone_id) assetCount += 1;
                }
                return { ...z, asset_count: Math.max(0, assetCount) };
            });

            // ── Push to React state immediately ───────────────────────────────
            const optimisticCache: InfrastructureAnalytics = {
                ...sessionCache,
                statusDistribution: updatedStatus,
                zoneDistribution: updatedZones,
                kpis: deriveKpis(updatedStatus),
            };

            // Update module-level cache so it survives re-renders
            sessionCache = optimisticCache;
            // Trigger React re-render — no loading spinner, instant update
            setAnalytics(optimisticCache);
        });

        return () => deregisterOptimisticCallback(key);
    }, []);

    // ── Bus 2: Full revalidation — silent background re-fetch ────────────────
    // Called ~1500ms after the optimistic update by useRealtimeInfrastructureSync.
    useEffect(() => {
        const key = 'analytics';
        registerRefreshCallback(key, () => {
            sessionCache = null;
            cacheLoadedAt = null;
            fetchAnalytics(true);
        });
        return () => deregisterRefreshCallback(key);
    }, [fetchAnalytics]);

    return { analytics, loading, error, refreshAnalytics };
};
