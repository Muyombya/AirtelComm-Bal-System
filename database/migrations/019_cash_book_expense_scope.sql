BEGIN;

ALTER TABLE cash_book_entries
    ALTER COLUMN branch_id DROP NOT NULL;

ALTER TABLE cash_book_entries
    ADD COLUMN IF NOT EXISTS expense_scope VARCHAR(20) NOT NULL DEFAULT 'BRANCH';

UPDATE cash_book_entries
SET expense_scope = 'BRANCH'
WHERE expense_scope IS NULL OR TRIM(expense_scope) = '';

ALTER TABLE cash_book_entries
    DROP CONSTRAINT IF EXISTS cash_book_entries_expense_scope_check;

ALTER TABLE cash_book_entries
    ADD CONSTRAINT cash_book_entries_expense_scope_check
    CHECK (expense_scope IN ('BRANCH','COMPANY'));

ALTER TABLE cash_book_entries
    DROP CONSTRAINT IF EXISTS cash_book_entries_scope_branch_consistency_check;

ALTER TABLE cash_book_entries
    ADD CONSTRAINT cash_book_entries_scope_branch_consistency_check
    CHECK (
      (entry_type = 'TOP_UP' AND expense_scope = 'BRANCH' AND branch_id IS NOT NULL)
      OR
      (entry_type = 'EXPENSE' AND expense_scope = 'BRANCH' AND branch_id IS NOT NULL)
      OR
      (entry_type = 'EXPENSE' AND expense_scope = 'COMPANY' AND branch_id IS NULL)
    );

CREATE INDEX IF NOT EXISTS idx_cash_book_entries_scope_date
    ON cash_book_entries(expense_scope, business_date, entry_type);

COMMIT;
