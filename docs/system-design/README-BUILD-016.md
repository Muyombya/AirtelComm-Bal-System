# BUILD 016 — General Shop Status: Dynamic Branch Selection

## Purpose
Make General Shop Status branch-aware so the same screen can display the status of any active branch instead of defaulting to Kitende.

## Changes
- Added an explicit Branch selector to General Shop Status.
- Branches are loaded from the database through the existing `/api/branches` endpoint.
- Selecting another branch reloads the complete General Shop Status for that branch and selected business date.
- Removed the server-side fallback to Branch ID 1 for General Shop Status GET and SAVE operations. A valid branch ID is now required.
- Kept the existing historical-date behavior and all existing General Shop Status calculations.
- No database migration is required.

## Files modified
- client/src/components/GeneralShopStatus.jsx
- client/src/general-shop-status-correction.css
- server/src/controllers/generalShopStatusController.js

## Files not touched
- Till Balancing
- Cash Book
- Branch Shortage Counter
- Terminal Management
- Master Data schema

## Test
1. Open General Shop Status.
2. Confirm the Branch selector shows all active branches in the database.
3. Select Kitende and confirm its current status.
4. Select another branch and confirm the branch name, tills, floats, transactions, capital, shortage counter and history all reload for that branch.
5. Switch back to Kitende and confirm its data remains unchanged.
6. Select a historical date for each branch and confirm historical read-only behavior remains intact.
