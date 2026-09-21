# BUILD 038 — Terminal Branch Assignment

## Purpose
Terminals are now branch-owned operational assets. A terminal must be assigned to a branch when it is registered. Its branch assignment can later be transferred or removed while preserving history.

## Modified files
- `client/src/components/TerminalManagement.jsx`
- `client/src/services/api.js`
- `server/src/controllers/terminalController.js`
- `server/src/routes/terminalRoutes.js`
- `database/migrations/038_terminal_branch_assignment.sql`

## Database behavior
Adds `terminal_branch_assignments` with historical `active_from` / `active_to` records.

Existing terminals are backfilled from their latest Till assignment where available. No branch is invented for a legacy terminal that has never been assigned to a Till.

## Registration
A Branch field is mandatory during terminal registration.
The server validates both the Service Provider and Branch before creating the terminal and its initial branch assignment in one transaction.

## Transfer
- Manager selects Transfer on an active terminal.
- A target branch is required.
- The previous branch assignment is closed.
- Any active Till assignment is closed and retained as historical data.
- A new branch assignment is created.
- The terminal remains active.
- The terminal must then be assigned to a Till in the new branch.

## Removal
- Manager selects Remove.
- The terminal is removed from its current branch assignment.
- Any active Till assignment is closed and retained.
- The terminal is marked INACTIVE.
- Branch history remains available.

## Till safety rule
An active terminal can only be assigned to a Till belonging to the same branch. This is enforced by the backend, not only by the GUI.

## GUI additions
- Branch required at registration.
- Branch shown in terminal register.
- Branch filter added.
- Transfer action.
- Remove action.
- Branch history view.
- Till assignment list only offers terminals belonging to the selected Till's branch.

## Not changed
No Till Balancing calculations, General Shop Status, Cash Book, user roles, or operating-capital logic were changed.

## Validation performed
- Node syntax checks passed for the modified backend controller, routes, and API service file.
- JSX parser check was not available in the build environment; the supplied JSX should be tested through the user's Vite GUI as the next step.

## Required test order
1. Run migration 038 in the existing `airtelcomm_bal_system` database.
2. Start backend and frontend.
3. Open Terminal Management.
4. Register a test terminal and confirm Branch is mandatory.
5. Confirm the new terminal appears with its branch.
6. Transfer the test terminal to another branch and confirm its old branch history remains.
7. Confirm the terminal no longer appears as assignable to a Till in the old branch.
8. Assign it to a Till in the new branch.
9. Remove the test terminal and confirm it becomes INACTIVE and its branch/Till history remains.
10. Clean up the test terminal if desired.

Do not proceed to another feature until BUILD 038 is confirmed through the GUI.
