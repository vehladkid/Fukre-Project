import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { registerRefreshCallback, deregisterRefreshCallback } from '../../lib/intelligenceRefresh';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssetHealth {
    id: string;
    name: string;
    zone_id: string | null;
    status_name: string | null;
    color_code: string | null;
    severity_level: number | null;
    health_score: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    inspection_age_days: number;
    is_overdue_inspection: boolean;
    last_inspected: string | null;
    latitude: number | null;
    longitude: number | null;
}

export interface ZoneRisk {
    zone_id: string;
    zone_name: string;
    total_assets: number;
    avg_health_score: number;
    critical_count: number;
    overdue_count: number;
    high_risk_count: number;
    zone_risk_score: number;
    zone_risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SystemAlert {
    alert_type: 'CRITICAL_ASSET' | 'OVERDUE_INSPECTION' | 'HIGH_RISK_ZONE';
    message: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    zone_id: string | null;
    asset_id: string | null;
    created_at: string;
}

export interface CityHealthSummary {
    avg_health_score: number;
    total_assets: number;
    overdue_count: number;
    high_risk_asset_count: number;
    high_risk_zone_count: number;
    alert_count: number;
}

export interface InfrastructureHealth {
    summary: CityHealthSummary;
    assetHealth: AssetHealth[];
    zoneRisk: ZoneRisk[];
    alerts: SystemAlert[];
}

// ─── Session Cache ────────────────────────────────────────────────────────────
let healthCache: InfrastructureHealth | null = null;
let healthCacheAt: number | null = null;
// TTL = 0 — always fetch fresh on mount. Cache is used only for
// optimistic inter-render stability during realtime mutations.
const CACHE_TTL_MS = 0;

function isCacheValid(): boolean {
    if (!healthCache || !healthCacheAt) return false;
    return Date.now() - healthCacheAt < CACHE_TTL_MS;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useInfrastructureHealth = () => {
    const [health, setHealth] = useState<InfrastructureHealth>({
        summary: {
            avg_health_score: 0,
            total_assets: 0,
            overdue_count: 0,
            high_risk_asset_count: 0,
            high_risk_zone_count: 0,
            alert_count: 0,
        },
        assetHealth: [],
        zoneRisk: [],
        alerts: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHealth = useCallback(async (forceRefresh = false) => {
        if (!forceRefresh && isCacheValid()) {
            setHealth(healthCache!);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [healthRes, zoneRes, alertsRes] = await Promise.all([
                supabase
                    .from('infrastructure_health_view')
                    .select('id,name,zone_id,status_name,color_code,severity_level,health_score,risk_level,inspection_age_days,is_overdue_inspection,last_inspected,latitude,longitude'),
                supabase.from('zone_risk_view').select('*'),
                supabase.from('system_alerts_view').select('*').limit(50),
            ]);

            if (healthRes.error) throw healthRes.error;
            if (zoneRes.error) throw zoneRes.error;
            if (alertsRes.error) throw alertsRes.error;

            const assetHealth = (healthRes.data ?? []) as AssetHealth[];
            const zoneRisk = (zoneRes.data ?? []) as ZoneRisk[];
            const alerts = (alertsRes.data ?? []) as SystemAlert[];

            // Derive city-level summary from asset health array
            const total = assetHealth.length;
            const avgScore = total > 0
                ? Math.round(assetHealth.reduce((sum, a) => sum + a.health_score, 0) / total)
                : 0;

            const summary: CityHealthSummary = {
                avg_health_score: avgScore,
                total_assets: total,
                overdue_count: assetHealth.filter(a => a.is_overdue_inspection).length,
                high_risk_asset_count: assetHealth.filter(a => a.risk_level === 'HIGH').length,
                high_risk_zone_count: zoneRisk.filter(z => z.zone_risk_level === 'HIGH').length,
                alert_count: alerts.length,
            };

            const result: InfrastructureHealth = { summary, assetHealth, zoneRisk, alerts };
            healthCache = result;
            healthCacheAt = Date.now();
            setHealth(result);
        } catch (err: any) {
            console.error('Health fetch error:', err);
            setError(err.message || 'Failed to load health data');
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Initial fetch on mount ────────────────────────────────────────────────
    useEffect(() => {
        fetchHealth();
    }, [fetchHealth]);

    // ── Manual refresh (also used by refresh button) ──────────────────────────
    const refreshHealth = useCallback(() => {
        healthCache = null;
        healthCacheAt = null;
        fetchHealth(true);
    }, [fetchHealth]);

    // ── Register with intelligence refresh bus ────────────────────────────────
    // When a DB change fires via useRealtimeInfrastructureSync, this refresh
    // will be called automatically — no manual refresh needed.
    useEffect(() => {
        const key = 'health';
        registerRefreshCallback(key, () => {
            healthCache = null;
            healthCacheAt = null;
            fetchHealth(true);
        });
        return () => deregisterRefreshCallback(key);
    }, [fetchHealth]);

    return { health, loading, error, refreshHealth };
};
