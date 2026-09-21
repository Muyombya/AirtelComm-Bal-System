BEGIN;

ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS app_users_role_check;

ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS app_users_check;

ALTER TABLE app_users
  ADD CONSTRAINT app_users_role_check
  CHECK (role IN ('MANAGER','SUPERVISOR','BRANCH_USER'));

ALTER TABLE app_users
  ADD CONSTRAINT app_users_branch_role_check
  CHECK (
    (role='MANAGER' AND branch_id IS NULL)
    OR
    (role IN ('SUPERVISOR','BRANCH_USER') AND branch_id IS NOT NULL)
  );

COMMIT;
