# BUILD 012 — Cash Book Fundamental Block

## Scope
Standalone branch Cash Book / Expense Fund. It is separate from Till Operating Capital, General Shop Status, Branch Shortage Counter, and Float positions.

## Formula
Opening Balance + cumulative Funds Added − cumulative Expenses = Closing Balance.

## Files added
- database/migrations/012_cash_book.sql
- server/src/controllers/cashBookController.js
- server/src/routes/cashBookRoutes.js
- client/src/components/CashBook.jsx
- client/src/cash-book.css

## Files modified/replacement included
- server/src/app.js — preserves existing health, terminal, Till Balancing and General Shop Status route mounts and adds Cash Book.
- client/src/App.jsx — preserves the existing three pages and adds Cash Book.
- client/src/services/api.js — preserves the known current API surface, including shortage payments and General Shop Status, and adds Cash Book functions.

## One import
Add this line to `client/src/index.css`:
`@import "./cash-book.css";`

## Not touched
- Till Balancing logic
- Terminal assignments / drag-and-drop
- General Shop Status component
- Branch Shortage Counter logic

## Migration
Run `012_cash_book.sql` against `airtelcomm_bal_system` only. Do not run it against `atlas_development`.

## Rules
- Opening Balance is established once for the branch and then locked after any Cash Book transaction.
- A transaction cannot be recorded until Opening Balance is established.
- Expenses cannot exceed the available Cash Book balance.
- Cash Book entries are historical and immutable in this build.
- No Cash Book operation changes Till Operating Capital.

## GUI TEST — BUILD 012
1. Start the existing backend and frontend.
2. Open **Cash Book**.
3. Confirm branch is Kitende.
4. Set Opening Balance to `1,000,000` and save.
5. Add Funds Added of `200,000`.
6. Record an Expense of `50,000`, category `Test`, description `Test expense`.
7. Confirm Closing Balance is `UGX 1,150,000`.
8. Confirm today's entries show both movements.
9. Try an expense larger than the available balance and confirm it is rejected.
10. Refresh and confirm entries remain.
11. Change Business Date to an earlier date and confirm historical entries remain accessible.
12. Return to today.
13. Confirm Till Balancing still opens and operates normally.

Do not proceed to another Cash Book feature until this build is confirmed.
