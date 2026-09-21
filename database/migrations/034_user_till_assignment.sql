BEGIN;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS till_id BIGINT REFERENCES tills(id) ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_app_users_till_id ON app_users(till_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_app_users_active_branch_user_till
  ON app_users(till_id)
  WHERE role = 'BRANCH_USER' AND status = 'ACTIVE' AND till_id IS NOT NULL;

COMMIT;
