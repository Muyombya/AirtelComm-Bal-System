# AirtelComm-Bal-System — BUILD 015 FIX 1

## Branch-first float allocation

This refinement corrects the hierarchy for float positions:

**Branch → Float Position → Till**

Float/terminal positions are first allocated to a branch. Only after that can a branch-owned float position be allocated to one of that branch's active Tills.

### Migration
Run against `airtelcomm_bal_system` only:

`psql -U postgres -d airtelcomm_bal_system -f database/migrations/016_branch_float_allocation.sql`

The migration creates `branch_terminal_allocations` and backfills active Till terminal assignments into branch ownership so existing data is preserved.

### GUI
Master Data now includes **Branch Float**. Select a branch, allocate a terminal/float position to the branch, then allocate that branch-owned position to a Till.

A branch-owned float cannot be released while it is still assigned to a Till.

## Files added
- database/migrations/016_branch_float_allocation.sql
- server/src/controllers/branchFloatController.js
- server/src/routes/branchFloatRoutes.js

## Files modified
- server/src/app.js
- client/src/services/api.js
- client/src/components/MasterData.jsx
- client/src/master-data.css

## Not changed
Till Balancing calculations, Cash Book calculations, General Shop Status calculations, Branch Shortage Counter, and existing terminal records.
