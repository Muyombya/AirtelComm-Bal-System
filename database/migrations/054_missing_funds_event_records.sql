-- Missing-funds records describe an event affecting a Till, not a worker.
-- Keep employee-based responsibility records supported, but allow event-only rows.
ALTER TABLE branch_shortage_responsibilities
  ALTER COLUMN employee_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_branch_shortage_missing_funds_till_date
  ON branch_shortage_responsibilities(till_id, responsibility_date, id)
  WHERE employee_id IS NULL AND till_id IS NOT NULL;
