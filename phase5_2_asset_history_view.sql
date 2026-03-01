-- =================================================================================
-- PHASE 5.2: ASSET LIFETIME INTELLIGENCE VIEW
-- =================================================================================
-- Deletion-safe history view combining audit logs with infrastructure assets.
-- Preserves asset names dynamically using COALESCE on JSON before_data.
-- =================================================================================

DROP VIEW IF EXISTS public.asset_audit_history;

CREATE OR REPLACE VIEW public.asset_audit_history
WITH (security_invoker = true)
AS
SELECT
    a.id,
    a.record_id AS asset_id,

    COALESCE(
        i.name,
        a.before_data->>'name'
    ) AS asset_name,

    a.action,
    a.before_data,
    a.after_data,
    a.changed_fields,
    a.created_at,
    a.user_id,
    a.operator_name,
    a.operator_role

FROM public.audit_logs_with_users a
LEFT JOIN public.infrastructure_assets i
ON i.id = a.record_id;

GRANT SELECT ON public.asset_audit_history TO authenticated;
