-- Allow one responsible worker's entry to reassign shortage across multiple
-- outstanding balances from its source Till without duplicating liability.
CREATE TABLE IF NOT EXISTS branch_shortage_responsibility_allocations (
  responsibility_id BIGINT NOT NULL REFERENCES branch_shortage_responsibilities(id) ON DELETE RESTRICT,
  till_balance_id BIGINT NOT NULL REFERENCES till_balances(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  PRIMARY KEY (responsibility_id, till_balance_id)
);

CREATE INDEX IF NOT EXISTS idx_shortage_responsibility_allocations_balance
  ON branch_shortage_responsibility_allocations(till_balance_id);

-- Preserve the existing single-event links in the new allocation ledger.
INSERT INTO branch_shortage_responsibility_allocations(responsibility_id,till_balance_id,amount)
SELECT id,till_balance_id,amount
FROM branch_shortage_responsibilities
WHERE till_balance_id IS NOT NULL
ON CONFLICT (responsibility_id,till_balance_id) DO NOTHING;
