# BUILD 035 — Supervisor Branch-Locked General Shop Status & Cash Book

## Purpose
Correct Supervisor access so the Supervisor automatically operates against the branch
assigned to their account.

### Supervisor
- General Shop Status: assigned branch only
- Cash Book: assigned branch only
- No branch selector
- No All Branches + Company view
- No Company / Central Cash Book view
- Company-wide expenditure panel is hidden
- Company expense creation is blocked server-side
- Monthly expense report and expense ledger are forced to the assigned branch

### Manager
Manager behavior remains company-wide and unchanged.

### Branch User
No change in this build.

## Security
The server-side `requireBranchAccess` middleware now makes the authenticated Supervisor's
`req.user.branch_id` authoritative. A Supervisor cannot override it by changing a
`branchId` in the URL or request body.

Cash Book expense-report routes are now protected as well.
Cash Book creation also rejects Company / Central expenses from Supervisor accounts.

## Files modified
- client/src/App.jsx
- client/src/components/GeneralShopStatus.jsx
- client/src/components/CashBook.jsx
- server/src/middleware/auth.js
- server/src/routes/generalShopStatusRoutes.js
- server/src/routes/cashBookRoutes.js
- server/src/routes/cashBookExpenseRoutes.js
- server/src/controllers/cashBookController.js
- server/src/controllers/cashBookExpenseController.js

## Files added
- client/src/supervisor-branch-lock.css
- README-BUILD-035.md

## Database
No migration required.

## Final implementation note
Supervisor pages do not rely on the Manager-only branch list to determine whether a branch exists. The authenticated Supervisor's `branch_id` and `branch_name` are sufficient to initialize and load the pages.

## Test
1. Log in as a Supervisor assigned to a real branch.
2. Open General Shop Status.
   - It should load the assigned branch.
   - There should be no branch selector.
3. Open Cash Book.
   - It should load the assigned branch immediately.
   - There should be no All Branches + Company option.
   - There should be no Company / Central option.
   - Company-wide expenditure should not be displayed.
4. Attempt to alter `branchId` manually in the browser/API request.
   - The server must still return the Supervisor's assigned branch data.
5. Attempt a Company / Central Cash Book expense as Supervisor.
   - Server must return HTTP 403.
6. Log in as Manager and confirm branch/company views remain available.

No Till Balancing, database, or Branch User behavior is changed.
