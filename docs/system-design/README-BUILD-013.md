# BUILD 013 — Cash Book Expense Tracking & Monthly Reconciliation

This build extends the tested Cash Book foundation into the branch-wide expense tracking flow reflected by the 2026 Monthly Branches Expenses workbook.

## Added
- Expense category master data seeded from recurring workbook expense types.
- Expense Category required for EXPENSE entries; Funds Added does not require a category.
- Monthly Expense Reconciliation with month selector.
- Monthly totals for Funds Added, Total Expenses and Net Movement.
- Expense-by-category totals and entry counts.
- Daily expense totals and entry counts.
- Existing daily Cash Book and historical views remain available.

## Migration
Run against `airtelcomm_bal_system` only:
`psql -U postgres -d airtelcomm_bal_system -f database/migrations/013_cash_book_expense_tracking.sql`

## Test
1. Run migration 013.
2. Start backend and frontend.
3. Open Cash Book.
4. Record an Expense and confirm Category is required.
5. Record Funds Added and confirm Category is not required.
6. Select the current month and verify the Monthly Expense Reconciliation updates.
7. Confirm category totals and daily totals reflect entries.
8. Confirm Cash Book opening balance, closing balance, history, and existing modules still work.
