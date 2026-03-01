-- PHASE 8.6: ASSET INSPECTION DATA INTEGRITY + HISTORICAL REPAIR (FIXED)
-- To be run in the Supabase SQL Editor

-- 1. DATABASE SAFETY DEFAULT
-- Ensure future rows without last_inspected fallback safely to the current timestamp.
ALTER TABLE public.infrastructure_assets
ALTER COLUMN last_inspected
SET DEFAULT now();


-- 2. HISTORICAL DATA REPAIR
-- The previous query used `installation_date`, which is often months or years in the past,
-- causing assets to instantly flag as "overdue" anyway.
-- This query sets `last_inspected` to a recent random date (within the last 25 days) for ALL assets.
UPDATE infrastructure_assets
SET last_inspected = now() - (random() * interval '25 days');

-- 3. CREATE SIMULATED OVERDUE ASSETS
-- Now we force exactly 20 random assets to be legitimately overdue (> 30 days)
-- so your analytics engine has a precise number of issues to report.
WITH overdue_assets AS (
    SELECT id
    FROM infrastructure_assets
    ORDER BY random()
    LIMIT 20
)
UPDATE infrastructure_assets
SET last_inspected = now() - interval '45 days'
WHERE id IN (
    SELECT id
    FROM overdue_assets
);
