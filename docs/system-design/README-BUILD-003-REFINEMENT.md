# BUILD 003 — Till Balancing Refinement Patch

This is an incremental corrective/refinement patch. It does NOT replace the project.

## Files to replace
- client/src/components/TillBalancing.jsx
- client/src/index.css
- server/src/controllers/tillBalanceController.js

## Database
No new migration is required. The existing 003 migration has already been applied.

## Changes
- COINS now uses 1,000 / 500 / 200 / 100 denominations with quantity-based calculation.
- Server accepts and validates those coin denominations as COINS line items.
- Numeric user-entry fields are centrally aligned for easier counting/data entry.
- Attendant name is larger and more prominent.
- Difference displays direction clearly: −UGX for SHORT and +UGX for EXCESS.
- Balance History now has event count and View details.
- Historical balance details show metadata, cash count, coin quantities, batch, float positions, totals, and final status.
- Existing balancing history is preserved; no records are deleted or altered by this patch.

## Important
Do not rerun any migration for this patch.
Do not replace App.jsx, api.js, database files, or configuration files.
