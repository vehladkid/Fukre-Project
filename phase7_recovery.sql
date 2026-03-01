-- =================================================================================
-- PHASE 7: ARCHITECTURAL RECOVERY SCRIPT
-- =================================================================================
-- Run ONCE in Supabase SQL Editor.
--
-- PURPOSE: Correct any prior implementation that created static tables instead
--          of views for infrastructure health intelligence.
--
-- ARCHITECTURE LAW:
--   Health intelligence is COMPUTED, never stored.
--   All three objects below MUST be SQL VIEWs, not tables.
--   No INSERT is required or permitted.
--
-- SUCCESS TEST:
--   UPDATE a.status_id on infrastructure_assets → health_score changes instantly.
--   UPDATE a.last_inspected                     → inspection_age_days changes instantly.
--   Zone risk and alerts reflect changes with zero writes to any other table.
-- =================================================================================


-- ── STEP 1: Drop existing views (idempotent — CASCADE handles dependencies) ────
-- DROP VIEW IF EXISTS is safe whether or not the view exists.
-- All three are dropped dependency-first (alerts → zone → health).
DROP VIEW IF EXISTS public.system_alerts_view          CASCADE;
DROP VIEW IF EXISTS public.zone_risk_view               CASCADE;
DROP VIEW IF EXISTS public.infrastructure_health_view   CASCADE;


-- =================================================================================
-- ── VIEW 1: INFRASTRUCTURE HEALTH VIEW (per-asset computed intelligence) ─────────
-- =================================================================================
-- Joins infrastructure_assets ← asset_status.
-- Computes LIVE:
--   • inspection_age_days      (days since last_inspected, or 999 if never)
--   • is_overdue_inspection    (TRUE if > 90 days or never inspected)
--   • health_score (0–100):
--       base  = 100 − (severity_level − 1) × 20     (50 if unknown)
--       penalty = min(age_days / 3, 20)              (−20 pts max)
--       bonus   = +10 if inspected within 30 days
--       final   = CLAMP(base − penalty + bonus, 0, 100)
--   • risk_level               (HIGH / MEDIUM / LOW from final score)
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

        -- Inspection age in days (NULL → 999 so overdue logic still fires)
        COALESCE(
            EXTRACT(EPOCH FROM (now() - a.last_inspected)) / 86400,
            999
        )::INTEGER    AS inspection_age_days,

        -- Overdue: not inspected in 90 days, or never inspected
        CASE
            WHEN a.last_inspected IS NULL THEN TRUE
            WHEN EXTRACT(EPOCH FROM (now() - a.last_inspected)) / 86400 > 90 THEN TRUE
            ELSE FALSE
        END            AS is_overdue_inspection,

        -- Base score from status severity (unknown → 50 neutral)
        CASE
            WHEN s.severity_level IS NULL THEN 50
            ELSE GREATEST(0, 100 - (s.severity_level - 1) * 20)
        END            AS base_score,

        -- Inspection penalty: up to −20 pts for a 60-day-old inspection
        LEAST(
            COALESCE(
                EXTRACT(EPOCH FROM (now() - a.last_inspected)) / 86400,
                999
            ) / 3.0,
            20
        )::INTEGER    AS inspection_penalty,

        -- Recent inspection bonus: +10 if inspected within last 30 days
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


-- =================================================================================
-- ── VIEW 2: ZONE RISK VIEW (aggregated from infrastructure_health_view) ──────────
-- =================================================================================
-- Aggregates ONLY from infrastructure_health_view — never from raw tables.
-- zone_risk_score = inverse avg health + critical/overdue surcharges.
-- All numbers are live: no caching, no inserts.
-- =================================================================================

CREATE VIEW public.zone_risk_view
WITH (security_invoker = true)
AS
SELECT
    z.id                                AS zone_id,
    z.name                              AS zone_name,
    COUNT(h.id)                         AS total_assets,
    ROUND(AVG(h.health_score), 1)       AS avg_health_score,
    COUNT(h.id) FILTER (WHERE h.severity_level >= 5)   AS critical_count,
    COUNT(h.id) FILTER (WHERE h.is_overdue_inspection) AS overdue_count,
    COUNT(h.id) FILTER (WHERE h.risk_level = 'HIGH')   AS high_risk_count,

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


-- =================================================================================
-- ── VIEW 3: SYSTEM ALERTS VIEW (SELECT-only, no alert table) ────────────────────
-- =================================================================================
-- Generates alerts purely from SELECT logic across:
--   • infrastructure_health_view  → CRITICAL_ASSET, OVERDUE_INSPECTION
--   • zone_risk_view              → HIGH_RISK_ZONE
-- No INSERT, no alert table, no stored state.
-- =================================================================================

CREATE VIEW public.system_alerts_view
WITH (security_invoker = true)
AS
SELECT * FROM (

    -- Critical assets (severity_level >= 5)
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

    -- Overdue inspections (exclude already-critical to avoid duplicate alerts)
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

    -- High-risk zones
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


-- =================================================================================
-- ── VERIFICATION QUERIES (run to confirm everything is live) ────────────────────
-- =================================================================================
-- After running this script, execute the queries below in a separate SQL editor
-- session to verify the architecture is correct.
--
-- 1. Confirm all three objects are VIEWs (not tables):
--
--    SELECT table_name, table_type
--    FROM   information_schema.tables
--    WHERE  table_schema = 'public'
--      AND  table_name IN (
--             'infrastructure_health_view',
--             'zone_risk_view',
--             'system_alerts_view'
--           );
--    -- Expected: table_type = 'VIEW' for all three rows.
--
-- 2. Confirm health scores update automatically:
--
--    -- a. Note current health_score for any asset:
--    SELECT id, name, health_score, risk_level FROM infrastructure_health_view LIMIT 3;
--
--    -- b. Change its status to Critical (severity 5):
--    UPDATE infrastructure_assets
--    SET    status_id = (SELECT id FROM asset_status WHERE severity_level = 5 LIMIT 1)
--    WHERE  id = '<paste asset id>';
--
--    -- c. Re-query — health_score must drop, risk_level must become HIGH:
--    SELECT id, name, health_score, risk_level FROM infrastructure_health_view
--    WHERE  id = '<paste asset id>';
--
-- 3. Confirm alerts appear without any INSERT:
--
--    SELECT alert_type, message, severity FROM system_alerts_view LIMIT 10;
-- =================================================================================
