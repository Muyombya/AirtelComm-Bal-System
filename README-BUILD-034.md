# BUILD 034 — User-to-Till Assignment

## Purpose
A Branch User is assigned to one Till. After login, Till Balancing opens that assigned Till directly. There is no Till selector for Branch Users.

Managers retain full Till selection. Supervisors retain Till selection within their assigned branch through the existing branch-scoped Till API.

## Important existing-user step
Existing Branch Users created before this build have no Till assignment. Before they can use Till Balancing, a Manager must edit each Branch User and assign an active Till in that user's branch. The system will reject a Branch User login/use of Till Balancing if no Till is assigned.

The database intentionally does NOT make till_id globally NOT NULL yet, so existing accounts can be assigned safely through User Management.

## Run migration
psql -U postgres -d airtelcomm_bal_system -f database/migrations/034_user_till_assignment.sql

Expected final result: COMMIT

## Test
1. Log in as Manager.
2. Open User Management.
3. Edit the existing Branch User and assign an active Till belonging to the same branch.
4. Confirm the user's Till appears in the user list.
5. Log in as that Branch User.
6. Open Till Balancing. There must be no Till selector; the assigned Till should open automatically.
7. Record/test a balance and confirm it is the assigned Till.
8. Try to call another Till's balancing API manually if desired; server must return 403.
9. Create a second Branch User and try assigning the same active Till; it must be rejected.
10. Confirm Supervisor and Manager Till selection still works.

## Added
- database/migrations/034_user_till_assignment.sql
- README-BUILD-034.md

## Modified
- server/src/controllers/authController.js
- server/src/middleware/auth.js
- server/src/routes/tillBalanceRoutes.js
- server/src/controllers/tillBalanceController.js
- client/src/App.jsx
- client/src/components/UserManagement.jsx
- client/src/components/TillBalancing.jsx

## Not touched
All other application files, transactional data, and atlas_development.
