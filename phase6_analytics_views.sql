-- =================================================================================
-- PHASE 6 (NORMALIZED): INFRASTRUCTURE INTELLIGENCE ANALYTICS VIEWS
-- =================================================================================
-- ARCHITECTURE LAW (Phase 8):
--   ALL analytics MUST derive from the Intelligence Layer ONLY.
--   Raw tables (infrastructure_assets, asset_status) must NEVER be queried
--   directly by analytics views. Single source of truth = infrastructure_health_view.
--
-- Data flow:
--   Layer 1 (Source): infrastructure_assets, asset_status, zones, categories
--   Layer 2 (Compute): infrastructure_health_view  ◄── all analytics read from here
--   Layer 3 (Report):  analytics_* views, export_assets_view
-- =================================================================================


-- ── DROP OLD VIEWS (clean slate, dependency order) ────────────────────────────
DROP VIEW IF EXISTS public.export_assets_view             CASCADE;
DROP VIEW IF EXISTS public.analytics_category_maintenance CASCADE;
DROP VIEW IF EXISTS public.analytics_zone_distribution    CASCADE;
DROP VIEW IF EXISTS public.analytics_status_distribution  CASCADE;
DROP VIEW IF EXISTS public.analytics_kpi_summary          CASCADE;


-- =================================================================================
-- ── 1. STATUS DISTRIBUTION VIEW ──────────────────────────────────────────────────
-- Source: infrastructure_health_view (groups by status fields already computed).
-- KPI cards AND pie chart share this view — guaranteed consistency.
-- =================================================================================

CREATE VIEW public.analytics_status_distribution
WITH (security_invoker = true)
AS
SELECT
    status_id,
    status_name,
    color_code,
    severity_level,
    COUNT(id)    AS asset_count
FROM public.infrastructure_health_view
GROUP BY status_id, status_name, color_code, severity_level
ORDER BY severity_level ASC NULLS LAST;

GRANT SELECT ON public.analytics_status_distribution TO authenticated;


-- =================================================================================
-- ── 2. ZONE DISTRIBUTION VIEW ────────────────────────────────────────────────────
-- Source: infrastructure_health_view ONLY.
-- at_risk_count = assets where risk_level != 'LOW' OR is_overdue_inspection = TRUE.
-- No JOIN to infrastructure_assets or asset_status permitted.
-- =================================================================================

CREATE VIEW public.analytics_zone_distribution
WITH (security_invoker = true)
AS
SELECT
    h.zone_id,
    z.name                                              AS zone_name,
    COUNT(h.id)                                         AS asset_count,
    COUNT(h.id) FILTER (
        WHERE h.risk_level != 'LOW'
           OR h.is_overdue_inspection = TRUE
    )                                                   AS at_risk_count
FROM public.infrastructure_health_view h
LEFT JOIN public.zones z ON z.id = h.zone_id
GROUP BY h.zone_id, z.name
ORDER BY asset_count DESC;

GRANT SELECT ON public.analytics_zone_distribution TO authenticated;


-- =================================================================================
-- ── 3. CATEGORY MAINTENANCE VIEW ─────────────────────────────────────────────────
-- Source: infrastructure_health_view ONLY.
-- maintenance_count = risk_level = 'MEDIUM'
-- critical_count    = risk_level = 'HIGH'
-- No severity_level recomputation; risk_level is the authoritative signal.
-- =================================================================================

CREATE VIEW public.analytics_category_maintenance
WITH (security_invoker = true)
AS
SELECT
    h.category_id,
    c.name                                                                  AS category_name,
    COUNT(h.id)                                                             AS total_assets,
    COUNT(h.id) FILTER (WHERE h.risk_level = 'MEDIUM')                     AS maintenance_count,
    COUNT(h.id) FILTER (WHERE h.risk_level = 'HIGH')                       AS critical_count
FROM public.infrastructure_health_view h
LEFT JOIN public.infrastructure_categories c ON c.id = h.category_id
GROUP BY h.category_id, c.name
ORDER BY critical_count DESC, maintenance_count DESC;

GRANT SELECT ON public.analytics_category_maintenance TO authenticated;


-- =================================================================================
-- ── 4. CSV EXPORT VIEW ───────────────────────────────────────────────────────────
-- Source: infrastructure_health_view (base) + zones + infrastructure_categories.
-- Includes all intelligence columns: health_score, risk_level,
-- inspection_age_days, is_overdue_inspection.
-- Does NOT JOIN infrastructure_assets or asset_status directly.
-- =================================================================================

CREATE VIEW public.export_assets_view
WITH (security_invoker = true)
AS
SELECT
    h.id,
    h.name                      AS asset_name,
    z.name                      AS zone,
    c.name                      AS category,
    h.status_name               AS status,
    h.severity_level,
    h.color_code,
    h.health_score,
    h.risk_level,
    h.inspection_age_days,
    h.is_overdue_inspection,
    h.last_inspected,
    h.created_at,
    h.latitude,
    h.longitude
FROM public.infrastructure_health_view h
LEFT JOIN public.zones z                    ON z.id = h.zone_id
LEFT JOIN public.infrastructure_categories c ON c.id = h.category_id
ORDER BY h.health_score ASC, h.name ASC;

GRANT SELECT ON public.export_assets_view TO authenticated;
