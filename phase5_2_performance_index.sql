-- =================================================================================
-- PHASE 5.2: PERFORMANCE INDEX FOR ASSET HISTORY LOOKUPS
-- =================================================================================
-- Ensures history queries filtered by record_id are fast.
-- Without this index, PostgreSQL scans the entire audit_logs table.
-- =================================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_asset_lookup
ON public.audit_logs (record_id, created_at DESC);
