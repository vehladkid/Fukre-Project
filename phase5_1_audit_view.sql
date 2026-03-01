-- =================================================================================
-- PHASE 5.1: AUDIT LOGS VIEW
-- =================================================================================
-- Creates a secure view integrating the audit logs with the operators' profile data
-- for use by the Admin Intelligence Panel.
-- =================================================================================

-- 1. Create the View with security_invoker = true to respect RLS of underlying tables
CREATE OR REPLACE VIEW public.audit_logs_with_users
WITH (security_invoker = true)
AS
SELECT
    a.id,
    a.action,
    a.record_id,
    a.before_data,
    a.after_data,
    a.changed_fields,
    a.created_at,
    a.user_id,
    p.full_name AS operator_name,
    p.role AS operator_role
FROM public.audit_logs a
LEFT JOIN public.profiles p ON p.id = a.user_id;

-- 2. Grant access
GRANT SELECT ON public.audit_logs_with_users TO authenticated;
