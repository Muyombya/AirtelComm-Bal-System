# BUILD 014 — Multi-Branch Cash Book & Expense Structure

Extends the confirmed Cash Book foundation into a branch-aware expense and monthly reconciliation workflow.

## Changes
- Added GET /api/branches for branch selection.
- Cash Book branch selector supports an individual branch or All Branches.
- Individual branch mode retains opening balance, transactions, daily cash position and history.
- All Branches mode is management/reporting view only; transaction entry and opening-balance controls are disabled/hidden.
- Monthly expense report supports an individual branch or all branches.
- All Branches report includes monthly expense totals by branch, category totals across branches, and daily expense totals across branches.
- No database migration is required: existing cash_book_entries already carry branch_id and cash_book_accounts are already branch-specific.
- Existing Till Balancing, General Shop Status, Shortage Counter and Terminal functionality is not intentionally changed.

## Test
1. Restart backend.
2. Open Cash Book.
3. Confirm Branch selector appears.
4. Select Kitende and confirm existing Cash Book behavior remains.
5. Select All Branches and confirm this becomes a reporting-only view.
6. Choose the current month and verify Expenses by Branch, Expense by Category and Daily Expenses.
7. If additional branches are later created in branches, they will automatically appear in the selector and all-branch report.
