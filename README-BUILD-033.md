# BUILD 033 — Supervisor Role & Access Separation

## Purpose
Introduce the Supervisor account and separate branch-user responsibilities.

### Roles
- MANAGER: full access
- SUPERVISOR: Till Balancing, General Shop Status, Cash Book; assigned to one branch
- BRANCH_USER: Till Balancing only; assigned to one branch

General Shop Status and Cash Book are now protected server-side from Branch Users.
The Supervisor has access to both, but remains restricted to the assigned branch.

Manager User Management can create/edit Supervisor accounts and reset passwords for
both Branch Users and Supervisors.

## Database migration
Run only against `airtelcomm_bal_system`:

psql -U postgres -d airtelcomm_bal_system -f database/migrations/033_supervisor_role_access.sql

Expected final result:
COMMIT

## GUI test
1. Log in as Manager.
2. Open User Management.
3. Create one Supervisor and assign a real branch.
4. Confirm the Supervisor appears as Supervisor.
5. Sign in as Supervisor:
   - Till Balancing: available
   - General Shop Status: available
   - Cash Book: available
   - Master Data: unavailable
   - Terminal Management: unavailable
   - User Management: unavailable
6. Sign in as Branch User:
   - Till Balancing: available
   - General Shop Status: unavailable
   - Cash Book: unavailable
7. Attempting direct API access to General Shop Status or Cash Book as Branch User
   must return HTTP 403.
8. From Manager, reset the Supervisor password and confirm the Supervisor can use
   the temporary password and is required to change it.

## Files added
- database/migrations/033_supervisor_role_access.sql

## Files modified
- server/src/controllers/authController.js
- server/src/middleware/auth.js
- server/src/routes/generalShopStatusRoutes.js
- server/src/routes/cashBookRoutes.js
- client/src/App.jsx
- client/src/components/UserManagement.jsx

## Not touched
- Till Balancing calculations
- Cash Book calculations
- General Shop Status calculations
- Terminal data
- Master Data logic
- existing transactional records
- other client/server files
- atlas_development
