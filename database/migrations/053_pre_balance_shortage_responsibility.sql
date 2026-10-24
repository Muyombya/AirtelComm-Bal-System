-- Capture responsibility assignments during the Till Balance review.
-- difference remains the net Till variance after assigned worker liability;
-- gross_difference retains the physical count variance for audit.
ALTER TABLE till_balances
  ADD COLUMN IF NOT EXISTS gross_difference NUMERIC(18,2),
  ADD COLUMN IF NOT EXISTS responsibility_offset_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS new_responsibility_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

UPDATE till_balances
SET gross_difference = difference
WHERE gross_difference IS NULL;

ALTER TABLE till_balances
  ALTER COLUMN gross_difference SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_branch_shortage_responsibilities_balance_date
  ON branch_shortage_responsibilities(till_balance_id,responsibility_date)
  WHERE till_balance_id IS NOT NULL;
