-- BUILD 009: Branch Shortage Counter payment ledger.
-- Fresh shortage (Added) is derived automatically from Till Balancing SHORT events.
-- Payments are stored as immutable entries so the employee debt history is preserved.
CREATE TABLE IF NOT EXISTS branch_shortage_payments (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_shortage_payments_employee_date
  ON branch_shortage_payments(branch_id, employee_id, payment_date);
