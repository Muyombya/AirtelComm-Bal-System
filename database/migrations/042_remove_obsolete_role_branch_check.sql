-- AirtelComm-Bal-System - Migration 042
-- Remove the obsolete role/branch constraint created by Migration 027.
--
-- Migration 027 supported only:
--   MANAGER
--   BRANCH_USER
--
-- The current authentication model supports:
--   MANAGER
--   SUPERVISOR
--   BRANCH_USER
--
-- The current role/branch integrity rules are enforced by:
--   app_users_branch_role_check
--   app_users_role_check

BEGIN;

ALTER TABLE app_users
    DROP CONSTRAINT IF EXISTS app_users_role_branch_check;

COMMIT;
