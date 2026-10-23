BEGIN;

-- Cash Book balances may legitimately be negative when expenses exceed
-- available funds. The ledger derives its closing balance from opening
-- balance + funds added - expenses, so top-ups naturally offset overdrafts.
ALTER TABLE cash_book_accounts
    DROP CONSTRAINT IF EXISTS cash_book_accounts_opening_balance_check;

COMMIT;
