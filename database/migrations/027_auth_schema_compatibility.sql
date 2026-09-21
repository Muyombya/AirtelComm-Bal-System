BEGIN;

-- Bring an existing app_users table created by an earlier authentication attempt
-- into the schema expected by the current authentication controller.
ALTER TABLE IF EXISTS app_users
  ADD COLUMN IF NOT EXISTS password_salt TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS role VARCHAR(20),
  ADD COLUMN IF NOT EXISTS branch_id BIGINT,
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Only fill defaults for rows that already exist; this does not create business data.
UPDATE app_users
SET must_change_password = COALESCE(must_change_password, TRUE),
    status = COALESCE(status, 'ACTIVE'),
    created_at = COALESCE(created_at, NOW()),
    updated_at = COALESCE(updated_at, NOW())
WHERE TRUE;

-- The current authentication layer requires these credential fields to be populated.
-- Existing invalid/empty Manager credentials are repaired by the application startup check.
ALTER TABLE app_users
  ALTER COLUMN password_salt SET NOT NULL,
  ALTER COLUMN password_hash SET NOT NULL,
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN must_change_password SET NOT NULL,
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

-- Ensure future rows receive the same safe defaults used by the application.
ALTER TABLE app_users
  ALTER COLUMN must_change_password SET DEFAULT TRUE,
  ALTER COLUMN status SET DEFAULT 'ACTIVE',
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

-- Add the foreign key only when branch_id exists and the constraint is not already present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'app_users'::regclass
      AND conname = 'app_users_branch_id_fkey'
  ) THEN
    ALTER TABLE app_users
      ADD CONSTRAINT app_users_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES branches(id)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END $$;

-- Existing installations may not have the role/branch integrity check.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'app_users'::regclass
      AND conname = 'app_users_role_branch_check'
  ) THEN
    ALTER TABLE app_users
      ADD CONSTRAINT app_users_role_branch_check
      CHECK ((role='MANAGER' AND branch_id IS NULL) OR (role='BRANCH_USER' AND branch_id IS NOT NULL));
  END IF;
END $$;

-- auth_sessions is also required by the current login flow.
CREATE TABLE IF NOT EXISTS auth_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

COMMIT;
