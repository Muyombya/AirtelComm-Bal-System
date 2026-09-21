# BUILD 003 — Till Balancing Formatting & Float Order Refinement

Incremental patch. Do not replace the project.

## Files to add
- `database/migrations/004_till_terminal_order.sql`

## Files to replace/update
- `client/src/components/TillBalancing.jsx`
- `client/src/index.css`
- `client/src/services/api.js`
- `server/src/controllers/terminalController.js`
- `server/src/controllers/tillBalanceController.js`
- `server/src/routes/terminalRoutes.js`

## What changes
1. Batch and terminal float amount inputs display comma separators while retaining numeric values.
2. The result card becomes light green for EXCESS and light red for SHORT.
3. UGX 500, 200 and 100 are removed from the NOTES section. They remain available in the COINS section.
4. Active Till float positions can be moved up/down with arrow controls.
5. Float-position order is stored in PostgreSQL so it survives page refreshes and future balancing screens.
6. Newly assigned terminals are appended to the end of the Till's current order.

## Database
Run the new migration once:

`psql -U postgres -d airtelcomm_bal_system -f database/migrations/004_till_terminal_order.sql`

Do not rerun migrations 001, 002 or 003.

## Testing
After integration and migration:
- Open Till Balancing.
- Confirm note rows stop at UGX 1,000 before BATCH.
- Confirm COINS still show UGX 1,000, 500, 200 and 100.
- Enter `1,000,000` into BATCH and confirm it displays with commas.
- Enter a float amount such as `9,915,647` and confirm comma formatting.
- Enter a value producing EXCESS and confirm the result card is green.
- Enter a value producing SHORT and confirm the result card is red.
- Use ↑/↓ beside active terminals to reorder them.
- Refresh the page and confirm the new order remains.

No existing balance records are changed by this patch.
