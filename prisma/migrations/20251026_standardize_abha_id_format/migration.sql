-- Migration: Standardize ABHA ID (Health ID) Format
-- Date: 2025-10-26
-- Purpose: Convert all 14-digit ABHA IDs without dashes to standard format XX-XXXX-XXXX-XXXX
-- Impact: Updates approximately 135,225 records (based on current data analysis)

-- ============================================================================
-- BACKGROUND
-- ============================================================================
-- The ABHA ID (Health ID) field currently has inconsistent formatting:
-- - Some IDs have dashes: "12-3456-7890-1234" (correct format)
-- - Some IDs don't have dashes: "12345678901234" (needs formatting)
-- - Some IDs are invalid: "N/A", partial numbers, etc. (leave unchanged)
--
-- This migration standardizes all valid 14-digit IDs to the format: XX-XXXX-XXXX-XXXX
-- ============================================================================

-- ============================================================================
-- STEP 1: ANALYZE CURRENT DATA (Optional - for verification)
-- ============================================================================
-- Uncomment these queries to see the current state before migration:

-- -- Count of records by format type:
-- SELECT 
--   CASE 
--     WHEN health_id IS NULL THEN 'NULL'
--     WHEN health_id LIKE '%-%' THEN 'Already Formatted (with dashes)'
--     WHEN health_id REGEXP '^[0-9]{14}$' THEN 'Needs Formatting (14 digits, no dashes)'
--     ELSE 'Invalid Format'
--   END AS format_type,
--   COUNT(*) AS count
-- FROM residents
-- WHERE health_id IS NOT NULL
-- GROUP BY format_type;

-- -- Sample records that will be updated:
-- SELECT 
--   resident_id,
--   name,
--   health_id AS old_format,
--   CONCAT(
--     SUBSTRING(health_id, 1, 2), '-',
--     SUBSTRING(health_id, 3, 4), '-',
--     SUBSTRING(health_id, 7, 4), '-',
--     SUBSTRING(health_id, 11, 4)
--   ) AS new_format
-- FROM residents
-- WHERE health_id REGEXP '^[0-9]{14}$'
-- LIMIT 10;

-- ============================================================================
-- STEP 2: UPDATE HEALTH IDs TO STANDARD FORMAT
-- ============================================================================
-- This update will:
-- 1. Find all health_id values that are exactly 14 numeric digits (no dashes)
-- 2. Format them as XX-XXXX-XXXX-XXXX
-- 3. Leave all other values unchanged (already formatted, invalid, NULL, etc.)

UPDATE `residents`
SET `health_id` = CONCAT(
  SUBSTRING(`health_id`, 1, 2), '-',
  SUBSTRING(`health_id`, 3, 4), '-',
  SUBSTRING(`health_id`, 7, 4), '-',
  SUBSTRING(`health_id`, 11, 4)
)
WHERE 
  -- Only update records that are exactly 14 numeric digits without dashes
  `health_id` REGEXP '^[0-9]{14}$';

-- ============================================================================
-- STEP 3: VERIFY RESULTS (Optional - run after migration)
-- ============================================================================
-- Uncomment these queries to verify the migration was successful:

-- -- Count of records by format type after migration:
-- SELECT 
--   CASE 
--     WHEN health_id IS NULL THEN 'NULL'
--     WHEN health_id LIKE '%-%' THEN 'Formatted (with dashes)'
--     WHEN health_id REGEXP '^[0-9]{14}$' THEN 'Unformatted (14 digits, no dashes)'
--     ELSE 'Invalid Format'
--   END AS format_type,
--   COUNT(*) AS count
-- FROM residents
-- WHERE health_id IS NOT NULL
-- GROUP BY format_type;

-- -- Sample of updated records:
-- SELECT 
--   resident_id,
--   name,
--   health_id
-- FROM residents
-- WHERE health_id LIKE '__-____-____-____'
-- LIMIT 10;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- WARNING: There is no automatic rollback for this migration because:
-- 1. We don't store the original format before updating
-- 2. The update is a one-way transformation (adding dashes)
-- 
-- If you need to rollback, you would need to:
-- 1. Restore from a database backup taken before this migration
-- 2. Or manually remove dashes from affected records (not recommended)
--
-- To remove dashes (NOT RECOMMENDED - only if absolutely necessary):
-- UPDATE `residents`
-- SET `health_id` = REPLACE(`health_id`, '-', '')
-- WHERE `health_id` LIKE '__-____-____-____';

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. This migration is IDEMPOTENT - it can be run multiple times safely
--    because it only updates records matching the pattern '^[0-9]{14}$'
--    (14 digits with no dashes)
--
-- 2. Records that are already formatted (with dashes) will NOT be affected
--
-- 3. Invalid Health IDs (like "N/A", partial numbers, etc.) will NOT be changed
--
-- 4. NULL values will remain NULL
--
-- 5. The REGEXP pattern '^[0-9]{14}$' ensures we only update valid 14-digit IDs
--
-- 6. Based on current data analysis (2025-10-26):
--    - Total residents with Health IDs: 1,692,872
--    - Already formatted: 1,157,447
--    - Will be updated by this migration: 135,225
--    - Invalid format (unchanged): 400,200
--
-- 7. This migration should complete in a few seconds to a few minutes
--    depending on database size and server performance
--
-- 8. It's recommended to:
--    - Take a database backup before running this migration
--    - Run during low-traffic hours if possible
--    - Test on a staging environment first
-- ============================================================================

