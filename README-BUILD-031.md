# BUILD 031 — User Management & Branch Access Boundary

## Scope
Adds the Manager-facing User Management screen and tightens the branch list API so a BRANCH_USER can only receive their assigned branch.

## Manager
Manager can:
- create Manager or Branch User accounts
- assign Branch Users to an active branch
- edit role, branch assignment and account status
- view all system users

## Branch User
Branch Users remain limited to:
- Till Balancing
- General Shop Status
- Cash Book
- their assigned branch

Master Data, Terminal Management and User Management remain Manager-only.

## Passwords
New accounts receive an initial password and are marked `must_change_password = TRUE`, so the existing first-login password-change flow applies.

## Run migration
psql -U postgres -d airtelcomm_bal_system -f database/migrations/031_user_management_branch_access.sql

Expected final result: COMMIT

## Files added
- client/src/components/UserManagement.jsx
- client/src/user-management.css
- database/migrations/031_user_management_branch_access.sql
- README-BUILD-031.md

## Files modified
- client/src/App.jsx
- client/src/index.css
- server/src/routes/branchRoutes.js

## Not touched
- Till Balancing calculations
- General Shop Status calculations
- Cash Book calculations
- Terminal data
- Master Data controller logic
- existing transactional records
- atlas_development
