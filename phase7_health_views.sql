-- =================================================================================
-- PHASE 7: INFRASTRUCTURE HEALTH INTELLIGENCE VIEWS
-- =================================================================================
-- Run in Supabase SQL Editor. Idempotent — safe to re-run at any time.
-- All intelligence COMPUTED in PostgreSQL — never stored.
-- Reads only: infrastructure_assets, asset_status, zones.
-- =================================================================================


-- ── SAFETY: Drop existing views clean (idempotent) ────────────────────────────
-- DROP VIEW IF EXISTS is safe whether or not the view exists.
-- All three dropped dependency-first so CASCADE is never needed.
DROP VIEW IF EXISTS public.system_alerts_view          CASCADE;
DROP VIEW IF EXISTS public.zone_risk_view               CASCADE;
DROP VIEW IF EXISTS public.infrastructure_health_view   CASCADE;


-- ── 1. INFRASTRUCTURE HEALTH VIEW (per-asset) ─────────────────────────────────
-- Computes health_score (0–100), inspection age, overdue flag, and risk_level.
--
-- Health Score Formula:
--   BASE SCORE = 100 − (severity_level − 1) × 20
--     • Operational (sev 1)  → 80 base
--     • Maintenance (sev 3)  → 60 base
--     • Under Repair (sev 4) → 40 base
--     • Critical (sev 5)     → 20 base
--     • Unknown              → 50 base
--
--   INSPECTION PENALTY = min(inspection_age_days / 3, 20)
--     losing up to 20 pts for a 60-day-old inspection
--
--   RECENT BONUS: +10 if inspected within 30 days
--
--   Final score clamped between 0 and 100.
-- =================================================================================

CREATE VIEW public.infrastructure_health_view
WITH (security_invoker = true)
AS
WITH base AS (
    SELECT
        a.id,
        a.name,
        a.zone_id,
        a.category_id,
        a.latitude,
        a.longitude,
        a.last_inspected,
        a.created_at,
        s.id          AS status_id,
        s.name        AS status_name,
        s.color_code,
        s.severity_level,

        -- Inspection age in days (NULL if never inspected defaults to 999)
        COALESCE(
            EXTRACT(EPOCH FROM (now() - a.last_inspected)) / 86400,
            999
        )::INTEGER    AS inspection_age_days,

        -- Overdue if not inspected in 90 days (or never)
        CASE
            WHEN a.last_inspected IS NULL THEN TRUE
            WHEN EXTRACT(EPOCH FROM (now() - a.last_inspected)) / 86400 > 90 THEN TRUE
            ELSE FALSE
        END            AS is_overdue_inspection,

        -- Base score from status severity
        CASE
            WHEN s.severity_level IS NULL THEN 50
            ELSE GREATEST(0, 100 - (s.severity_level - 1) * 20)
        END            AS base_score,

        -- Inspection penalty: up to −20 pts for 60+ day old inspection
        LEAST(
            COALESCE(
                EXTRACT(EPOCH FROM (now() - a.last_inspected)) / 86400,
                999
            ) / 3.0,
            20
        )::INTEGER    AS inspection_penalty,

        -- Recent inspection bonus: +10 if inspected within 30 days
        CASE
            WHEN a.last_inspected IS NOT NULL
             AND EXTRACT(EPOCH FROM (now() - a.last_inspected)) / 86400 <= 30
            THEN 10
            ELSE 0
        END            AS recent_bonus

    FROM public.infrastructure_assets a
    LEFT JOIN public.asset_status s ON s.id = a.status_id
)
SELECT
    id,
    name,
    zone_id,
    category_id,
    latitude,
    longitude,
    status_id,
    status_name,
    color_code,
    severity_level,
    last_inspected,
    created_at,
    inspection_age_days,
    is_overdue_inspection,

    -- Final clamped health score
    GREATEST(0, LEAST(100,
        base_score - inspection_penalty + recent_bonus
    ))::INTEGER    AS health_score,

    -- Risk level derived from final score
    CASE
        WHEN GREATEST(0, LEAST(100, base_score - inspection_penalty + recent_bonus)) >= 70
            THEN 'LOW'
        WHEN GREATEST(0, LEAST(100, base_score - inspection_penalty + recent_bonus)) >= 40
            THEN 'MEDIUM'
        ELSE 'HIGH'
    END            AS risk_level

FROM base;

GRANT SELECT ON public.infrastructure_health_view TO authenticated;


-- ── 2. ZONE RISK AGGREGATION VIEW ─────────────────────────────────────────────
-- Aggregates health intelligence per zone.

CREATE VIEW public.zone_risk_view
WITH (security_invoker = true)
AS
SELECT
    z.id                                AS zone_id,
    z.name                              AS zone_name,
    COUNT(h.id)                         AS total_assets,
    ROUND(AVG(h.health_score), 1)       AS avg_health_score,
    COUNT(h.id) FILTER (WHERE h.severity_level >= 5)    AS critical_count,
    COUNT(h.id) FILTER (WHERE h.is_overdue_inspection)  AS overdue_count,
    COUNT(h.id) FILTER (WHERE h.risk_level = 'HIGH')    AS high_risk_count,

    -- Zone risk score: inverse of avg health, boosted by critical/overdue density
    GREATEST(0, LEAST(100,
        100 - COALESCE(AVG(h.health_score), 100)
        + COUNT(h.id) FILTER (WHERE h.severity_level >= 5) * 5
        + COUNT(h.id) FILTER (WHERE h.is_overdue_inspection) * 2
    ))::INTEGER                        AS zone_risk_score,

    -- Zone risk level label
    CASE
        WHEN (100 - COALESCE(AVG(h.health_score), 100)
             + COUNT(h.id) FILTER (WHERE h.severity_level >= 5) * 5
             + COUNT(h.id) FILTER (WHERE h.is_overdue_inspection) * 2) >= 50
            THEN 'HIGH'
        WHEN (100 - COALESCE(AVG(h.health_score), 100)
             + COUNT(h.id) FILTER (WHERE h.severity_level >= 5) * 5
             + COUNT(h.id) FILTER (WHERE h.is_overdue_inspection) * 2) >= 25
            THEN 'MEDIUM'
        ELSE 'LOW'
    END                                AS zone_risk_level

FROM public.zones z
LEFT JOIN public.infrastructure_health_view h ON h.zone_id = z.id
GROUP BY z.id, z.name
ORDER BY zone_risk_score DESC;

GRANT SELECT ON public.zone_risk_view TO authenticated;


-- ── 3. SYSTEM ALERTS VIEW ─────────────────────────────────────────────────────
-- Auto-generates alerts from existing data. No alert table required.
-- Alert types: CRITICAL_ASSET, OVERDUE_INSPECTION, HIGH_RISK_ZONE
-- ORDER BY uses a wrapping subquery — required by PostgreSQL for UNION + CASE sort.

CREATE VIEW public.system_alerts_view
WITH (security_invoker = true)
AS
SELECT * FROM (

    -- Critical assets
    SELECT
        'CRITICAL_ASSET'                                        AS alert_type,
        'Critical: ' || name || ' requires immediate attention' AS message,
        'CRITICAL'                                              AS severity,
        zone_id,
        id                                                      AS asset_id,
        created_at
    FROM public.infrastructure_health_view
    WHERE severity_level >= 5

    UNION ALL

    -- Overdue inspections (non-critical only to avoid duplicates)
    SELECT
        'OVERDUE_INSPECTION',
        'Overdue Inspection: ' || name || ' — ' || inspection_age_days || ' days since last check',
        CASE
            WHEN inspection_age_days > 180 THEN 'HIGH'
            WHEN inspection_age_days > 90  THEN 'MEDIUM'
            ELSE 'LOW'
        END,
        zone_id,
        id,
        created_at
    FROM public.infrastructure_health_view
    WHERE is_overdue_inspection = TRUE
      AND (severity_level IS NULL OR severity_level < 5)

    UNION ALL

    -- High risk zones
    SELECT
        'HIGH_RISK_ZONE',
        'High Risk Zone: ' || zone_name || ' (risk score: ' || zone_risk_score || ')',
        'HIGH',
        zone_id,
        NULL::uuid,
        now()
    FROM public.zone_risk_view
    WHERE zone_risk_level = 'HIGH'

) alerts
ORDER BY
    CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH'     THEN 2
        WHEN 'MEDIUM'   THEN 3
        ELSE 4
    END,
    created_at DESC;

GRANT SELECT ON public.system_alerts_view TO authenticated;
