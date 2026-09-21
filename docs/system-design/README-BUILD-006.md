# BUILD 006 — Till Transaction Counts & General Shop Status Refinement

## Purpose

This incremental patch corrects the General Shop Status design so that:
- Daily transaction counts originate from the individual Till screens.
- General Shop Status displays those counts read-only.
- Accessories remain the manually entered General Shop Status activity field.
- An imbalance requires a brief reason before saving the branch status.
- General Shop Status has a History Status section.
- Closing Float Positions no longer displays service providers.
- Till float reordering remains compact, with the drag handle fixed at the left of each item.

## Database migration

Run once after integrating:

psql -U postgres -d airtelcomm_bal_system -f database/migrations/006_till_transactions_and_shop_status.sql

Do not rerun migrations 001–005.

## Files to add

database/migrations/006_till_transactions_and_shop_status.sql

## Files to replace

server/src/controllers/tillBalanceController.js
server/src/controllers/generalShopStatusController.js
server/src/routes/generalShopStatusRoutes.js
client/src/components/TillBalancing.jsx
client/src/components/GeneralShopStatus.jsx
client/src/services/api.js
client/src/index.css

## Files not touched

server/src/app.js
server/src/config/database.js
server/src/config/environment.js
server/src/controllers/terminalController.js
server/src/routes/terminalRoutes.js

No changes are required to existing migrations.

## Transaction-count behavior

The Till screen now contains Daily Transactions. Counts are stored per Till and business date in `till_transaction_counts` when Record Balance is submitted.

General Shop Status aggregates those Till records for the selected date. It does not provide editable transaction-count fields and does not save transaction counts itself.

## General Shop Status save behavior

Accessories and the Reason belong to the General Shop Status record.

Reason is mandatory when the calculated branch status is SHORT or EXCESS.

No manual provider/terminal data is introduced by this patch.
