-- Convert mandalCode and secCode from VARCHAR to INT
-- Step 1: Clean the data by removing ".0" suffix and converting to integers

-- Update mandalCode: Remove ".0" suffix
UPDATE `residents` 
SET `mandal_code` = CAST(REPLACE(`mandal_code`, '.0', '') AS CHAR)
WHERE `mandal_code` IS NOT NULL AND `mandal_code` LIKE '%.0';

-- Update secCode: Remove ".0" suffix  
UPDATE `residents`
SET `sec_code` = CAST(REPLACE(`sec_code`, '.0', '') AS CHAR)
WHERE `sec_code` IS NOT NULL AND `sec_code` LIKE '%.0';

-- Step 2: Alter column types from VARCHAR to INT
ALTER TABLE `residents` 
MODIFY COLUMN `mandal_code` INT NULL;

ALTER TABLE `residents`
MODIFY COLUMN `sec_code` INT NULL;

