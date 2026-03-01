-- =================================================================================
-- PHASE 5.2: VERIFICATION & AUDIT LIFECYCLE SIMULATION
-- =================================================================================
-- This script safely generates controlled audit history events by sequentially
-- mutating infrastructure assets, allowing the UIIP timeline to be verified.
-- Note: 'pg_sleep' is used to ensure distinct 'created_at' timestamps.
-- =================================================================================

DO $$
DECLARE
    v_admin_id uuid;
    v_operator_id uuid;
    
    v_category_id uuid;
    v_zone_id uuid;
    
    v_status_operational uuid;
    v_status_maintenance uuid;
    v_status_under_repair uuid;
    v_status_critical uuid;
    
    v_asset_id_1 uuid;
    v_asset_id_2 uuid;
BEGIN
    -- 1. Resolve IDs for simulation context
    SELECT id INTO v_admin_id FROM auth.users WHERE email = 'admin@uiip.gov' LIMIT 1;
    SELECT id INTO v_operator_id FROM auth.users WHERE email = 'operator@uiip.gov' LIMIT 1;
    
    -- Fallback to any user if specific emails don't exist (local dev)
    IF v_admin_id IS NULL THEN SELECT id INTO v_admin_id FROM auth.users LIMIT 1; END IF;
    IF v_operator_id IS NULL THEN v_operator_id := v_admin_id; END IF;

    -- Resolve Category/Zone
    SELECT id INTO v_category_id FROM public.infrastructure_categories LIMIT 1;
    SELECT id INTO v_zone_id FROM public.zones LIMIT 1;
    
    -- Resolve Statuses (names match exactly what was seeded in phase2_infrastructure_schema.sql)
    SELECT id INTO v_status_operational FROM public.asset_status WHERE name = 'Operational'          LIMIT 1;
    SELECT id INTO v_status_maintenance  FROM public.asset_status WHERE name = 'Maintenance Required' LIMIT 1;
    SELECT id INTO v_status_under_repair FROM public.asset_status WHERE name = 'Under Repair'         LIMIT 1;
    SELECT id INTO v_status_critical     FROM public.asset_status WHERE name = 'Critical'             LIMIT 1;

    -- If lookup failed, fallback safely
    IF v_status_operational IS NULL THEN SELECT id INTO v_status_operational FROM public.asset_status ORDER BY severity_level ASC  LIMIT 1; END IF;
    IF v_status_maintenance  IS NULL THEN v_status_maintenance  := v_status_operational; END IF;
    IF v_status_under_repair IS NULL THEN v_status_under_repair := v_status_maintenance;  END IF;
    IF v_status_critical     IS NULL THEN SELECT id INTO v_status_critical     FROM public.asset_status ORDER BY severity_level DESC LIMIT 1; END IF;


    ---------------------------------------------------------------------------
    -- LIFECYCLE SIMULATION 1: The "Repaired Asset" (Insert → Degrade → Repair)
    -- Exercises all 4 statuses: Operational → Maintenance Required → Under Repair → Critical → Operational
    ---------------------------------------------------------------------------
    
    -- Bypass Row Level Security completely for this script as it is a pure
    -- backend simulation. We don't want the frontend policies blocking us.
    -- (We keep the operator IDs in the row data so the history looks real)
    -- In Supabase SQL editor, the default role is postgres which naturally 
    -- bypasses RLS. We just shouldn't explicitly SET LOCAL role TO 'authenticated'.

    INSERT INTO public.infrastructure_assets 
        (name, category_id, zone_id, status_id, latitude, longitude)
    VALUES 
        ('SIM-PUMP-01 (Sector 4 Water Pump)', v_category_id, v_zone_id, v_status_operational, 28.6140, 77.2100)
    RETURNING id INTO v_asset_id_1;
    
    PERFORM pg_sleep(1);

    -- Step 2: Routine maintenance flagged
    UPDATE public.infrastructure_assets 
    SET status_id = v_status_maintenance, last_inspected = now() 
    WHERE id = v_asset_id_1;

    PERFORM pg_sleep(1);

    -- Step 3: Escalated to active repair
    UPDATE public.infrastructure_assets 
    SET status_id = v_status_under_repair
    WHERE id = v_asset_id_1;

    PERFORM pg_sleep(1);

    -- Step 4: Escalated to critical
    UPDATE public.infrastructure_assets 
    SET status_id = v_status_critical, latitude = 28.6145  -- moved slightly
    WHERE id = v_asset_id_1;

    PERFORM pg_sleep(1);

    -- Step 5: Repaired back to operational
    UPDATE public.infrastructure_assets 
    SET status_id = v_status_operational, last_inspected = now()
    WHERE id = v_asset_id_1;


    ---------------------------------------------------------------------------
    -- LIFECYCLE SIMULATION 2: The "Deleted Asset" (Insert -> Rename -> Delete)
    ---------------------------------------------------------------------------
    
    INSERT INTO public.infrastructure_assets 
        (name, category_id, zone_id, status_id, latitude, longitude)
    VALUES 
        ('SIM-TEMP-99 (Temporary Road Block)', v_category_id, v_zone_id, v_status_maintenance, 28.6200, 77.2200)
    RETURNING id INTO v_asset_id_2;

    PERFORM pg_sleep(1);

    UPDATE public.infrastructure_assets 
    SET name = 'SIM-TEMP-99 (Road Block - EXTENDED)', longitude = 77.2210
    WHERE id = v_asset_id_2;

    PERFORM pg_sleep(1);

    -- Simulating removal (History panel must survive this via COALESCE view logic)
    DELETE FROM public.infrastructure_assets 
    WHERE id = v_asset_id_2;


    RAISE NOTICE 'Lifecycle simulation complete. Asset 1 (Repaired) ID: %', v_asset_id_1;
    RAISE NOTICE 'Lifecycle simulation complete. Asset 2 (Deleted) ID: %', v_asset_id_2;

END $$;
