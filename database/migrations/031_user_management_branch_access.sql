BEGIN;

-- Build 031 does not introduce new tables. This migration documents and verifies
-- the branch-user access boundary used by the application.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='branch_id') THEN
    RAISE EXCEPTION 'app_users.branch_id is required for branch user access control';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='role') THEN
    RAISE EXCEPTION 'app_users.role is required for role access control';
  END IF;
END $$;

COMMIT;
