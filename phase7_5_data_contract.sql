-- =================================================================================
-- PHASE 7.5: INTELLIGENCE DATA CONTRACT ENFORCEMENT
-- =================================================================================
-- Run ONCE in Supabase SQL Editor.
--
-- PROBLEM: infrastructure_health_view uses last_inspected to compute health_score,
-- inspection_age_days, and is_overdue_inspection. When last_inspected is NULL,
-- inspection_age_days defaults to 999 and is_overdue_inspection = TRUE, causing
-- all new operational assets to appear HIGH risk with overdue alerts.
--
-- SOLUTION: Three-layer defense so last_inspected is ALWAYS valid:
--   1. Column DEFAULT  — covers SQL-level INSERTs that omit the field
--   2. BEFORE INSERT trigger — covers any INSERT path, including API
--   3. Repair query    — fixes existing NULL rows in the live database
-- =================================================================================


-- ── STEP 1: Set column default ────────────────────────────────────────────────
-- Any INSERT that omits last_inspected entirely gets now() automatically.
ALTER TABLE public.infrastructure_assets
ALTER COLUMN last_inspected SET DEFAULT now();


-- ── STEP 2: Repair existing records ───────────────────────────────────────────
-- For assets already in the DB with NULL last_inspected, set it to created_at
-- (when the asset was first registered — a safe and accurate baseline).
UPDATE public.infrastructure_assets
SET    last_inspected = created_at
WHERE  last_inspected IS NULL;


-- ── STEP 3: INSERT safety trigger ─────────────────────────────────────────────
-- Belt-and-suspenders over the DEFAULT: if the API sends an explicit NULL,
-- the DEFAULT is bypassed. This trigger catches that edge case.
CREATE OR REPLACE FUNCTION public.enforce_inspection_baseline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_inspected IS NULL THEN
        NEW.last_inspected := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_inspection_baseline
ON public.infrastructure_assets;

CREATE TRIGGER trg_enforce_inspection_baseline
BEFORE INSERT ON public.infrastructure_assets
FOR EACH ROW
EXECUTE FUNCTION public.enforce_inspection_baseline();


-- ── VERIFICATION ──────────────────────────────────────────────────────────────
-- After running this script:

-- 1. Confirm no NULL last_inspected values remain:
--    SELECT COUNT(*) FROM public.infrastructure_assets WHERE last_inspected IS NULL;
--    -- Expected: 0

-- 2. Confirm all operational assets now show LOW risk:
--    SELECT name, status_name, health_score, risk_level, is_overdue_inspection
--    FROM   public.infrastructure_health_view
--    WHERE  status_name = 'Operational'
--    ORDER  BY health_score DESC;
--    -- Expected: health_score >= 70, risk_level = 'LOW', is_overdue_inspection = FALSE

-- 3. Confirm trigger exists:
--    SELECT trigger_name FROM information_schema.triggers
--    WHERE  event_object_table = 'infrastructure_assets'
--      AND  trigger_name = 'trg_enforce_inspection_baseline';
--    -- Expected: 1 row
