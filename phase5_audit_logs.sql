-- =================================================================================
-- PHASE 5: URBAN INFRASTRUCTURE INTELLIGENCE PORTAL - AUDIT LOGGING SYSTEM
-- =================================================================================
-- GOAL: Government-grade audit trail mapping all asset changes accurately and safely.
-- RULES: No frontend changes. Trigger-based completely. RLS protected.
-- =================================================================================

-- 1. Create the Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name TEXT,
    record_id UUID,
    before_data JSONB,
    after_data JSONB,
    changed_fields JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Indexes for High Performance Querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- 3. Create the Database Trigger Function
CREATE OR REPLACE FUNCTION public.log_infrastructure_asset_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_changed_fields JSONB;
BEGIN
    -- Capture the authenticated user making the query via Supabase context
    v_user_id := auth.uid();

    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, before_data, after_data)
        VALUES (v_user_id, 'INSERT', TG_TABLE_NAME, NEW.id, NULL, to_jsonb(NEW));
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Calculate only the fields that actually changed
        -- Combines keys from old and new where the values are distinct
        SELECT jsonb_object_agg(n.key, n.value)
        INTO v_changed_fields
        FROM jsonb_each(to_jsonb(NEW)) n
        JOIN jsonb_each(to_jsonb(OLD)) o ON n.key = o.key
        WHERE n.value IS DISTINCT FROM o.value;

        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, before_data, after_data, changed_fields)
        VALUES (v_user_id, 'UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW), v_changed_fields);
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (user_id, action, table_name, record_id, before_data, after_data)
        VALUES (v_user_id, 'DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- SECUITY DEFINER ensures the trigger runs with elevated privileges, 
-- allowing it to insert into audit_logs even if RLS denies API inserts.

-- 4. Attach Trigger to Infrastructure Assets Table
DROP TRIGGER IF EXISTS audit_infrastructure_assets_changes ON public.infrastructure_assets;

CREATE TRIGGER audit_infrastructure_assets_changes
AFTER INSERT OR UPDATE OR DELETE ON public.infrastructure_assets
FOR EACH ROW EXECUTE FUNCTION public.log_infrastructure_asset_changes();

-- 5. Row Level Security (RLS) Configuration
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Note: We intentionally DO NOT create any INSERT/UPDATE/DELETE policies.
-- ALL mutations must originate from the trigger function above.
