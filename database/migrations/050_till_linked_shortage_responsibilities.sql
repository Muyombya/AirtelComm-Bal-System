-- Link outside-Till shortage responsibilities to the Till whose funds were
-- affected. When linked to a Till balance, the amount is reassigned from that
-- balance's attendant to the selected responsible worker.
ALTER TABLE branch_shortage_responsibilities
  ADD COLUMN IF NOT EXISTS till_id BIGINT REFERENCES tills(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS till_balance_id BIGINT REFERENCES till_balances(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_branch_shortage_responsibilities_balance
  ON branch_shortage_responsibilities(till_balance_id)
  WHERE till_balance_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_branch_shortage_responsibilities_till_date
  ON branch_shortage_responsibilities(branch_id,till_id,responsibility_date);
