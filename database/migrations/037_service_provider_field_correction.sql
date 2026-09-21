BEGIN;

-- The Master Data field previously called "Supervisor" was a misplaced field name.
-- Preserve existing values while changing the database meaning to Service.
ALTER TABLE service_providers
  RENAME COLUMN supervisor_name TO service_name;

COMMIT;
