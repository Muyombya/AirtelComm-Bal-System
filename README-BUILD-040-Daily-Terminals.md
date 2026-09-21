# BUILD 040 — Daily Transactions by Terminal

## Purpose
Change Daily Transactions from provider/service categories to the actual Terminal Names assigned to each Till.

## Changes
- Till Balancing keeps the title **Daily Transactions**.
- Till Balancing now creates one transaction-count row for every active terminal assigned to the selected Till.
- Transaction counts are stored against `terminal_id`, not a provider/service key.
- General Shop Status keeps the title **DAILY TRANSACTIONS**.
- General Shop Status displays **TERMINAL NAME** and **COUNT**.
- General Shop Status aggregates transaction counts by actual terminal ID/name across the branch.
- Existing legacy `service_key` transaction-count records are retained for historical compatibility; they are not guessed or reassigned to terminals.

## Database
Run:
`database/migrations/040_terminal_daily_transactions.sql`

The migration:
- adds nullable `terminal_id` to `till_transaction_counts`;
- permits legacy `service_key` values to remain;
- removes the old uniqueness rule based on `service_key`;
- adds uniqueness for `(till_id, business_date, terminal_id)` when terminal_id exists.

## Files added
- database/migrations/040_terminal_daily_transactions.sql
- README-BUILD-040-Daily-Terminals.md

## Files modified
- server/src/controllers/tillBalanceController.js
- server/src/controllers/generalShopStatusController.js
- client/src/components/TillBalancing.jsx
- client/src/components/GeneralShopStatus.jsx

## Files not touched
No other application files are included in this patch.

## TEST sequence
1. Apply migration 040.
2. Restart the backend.
3. Open Till Balancing.
4. Select a Till with several assigned terminals.
5. Confirm Daily Transactions lists the actual Terminal Names assigned to that Till.
6. Enter counts and Record Balance.
7. Reload the same Till/date and confirm the saved counts return against the same terminal names.
8. Open General Shop Status for the same branch/date.
9. Confirm the section is titled DAILY TRANSACTIONS.
10. Confirm the first column is TERMINAL NAME and the terminal names match the Till terminal assignments.
11. Confirm counts aggregate correctly across Tills without reverting to provider names.

Do not proceed to another feature until this test is confirmed.
