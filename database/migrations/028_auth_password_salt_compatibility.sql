BEGIN;

-- Bring the live app_users table into alignment with the authentication code.
-- The column is added nullable first so existing rows remain valid while the
-- initial Manager credential is repaired, then it is made NOT NULL.
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS password_salt TEXT;

-- Repair the initial Manager credential created by the authentication build.
-- This changes only the Manager authentication fields; business/master data is untouched.
UPDATE app_users
SET
  password_salt = 'AirtelComm-026-Initial-Salt',
  password_hash = '3389e46ec8449160bfae02a8a61d0bffa8aacceeffabff2367830d57a2b1d51b49c365862c2fbc951768bb28a0bc9fd9738a0db0293f65aa44c8c33eb365b775',
  role = 'MANAGER',
  branch_id = NULL,
  must_change_password = TRUE,
  status = 'ACTIVE',
  updated_at = NOW()
WHERE LOWER(username) = 'manager';

-- Any non-Manager rows that may already exist must have a valid salt before
-- the column can safely become mandatory. Generate a unique random-looking
-- deterministic salt per user from existing identity data without requiring
-- Node.js or external extensions.
UPDATE app_users
SET password_salt = 'AirtelComm-user-' || id::text
WHERE password_salt IS NULL OR BTRIM(password_salt) = '';

ALTER TABLE app_users
  ALTER COLUMN password_salt SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_username_lower
  ON app_users (LOWER(username));

COMMIT;
