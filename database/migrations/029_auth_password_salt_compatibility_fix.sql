BEGIN;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS password_salt TEXT;

UPDATE app_users
SET
  password_salt = 'AirtelComm-026-Initial-Salt',
  password_hash = '3389e46ec8449160bfae02a8a61d0bffa8aacceeffabff2367830d57a2b1d51b49c365862c2fbc951768bb28a0bc9fd9738a0db0293f65aa44c8c33eb365b775',
  role = 'MANAGER',
  branch_id = NULL,
  must_change_password = TRUE,
  status = 'ACTIVE'
WHERE LOWER(username) = 'manager';

UPDATE app_users
SET password_salt = 'AirtelComm-user-' || id::text
WHERE password_salt IS NULL OR BTRIM(password_salt) = '';

ALTER TABLE app_users
  ALTER COLUMN password_salt SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_app_users_username_lower
  ON app_users (LOWER(username));

COMMIT;
