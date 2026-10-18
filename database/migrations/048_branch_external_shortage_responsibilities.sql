-- Record branch shortage responsibilities that are not tied to a Till,
-- such as cash deposits held by a bank or deposit machine.
CREATE TABLE IF NOT EXISTS branch_shortage_responsibilities (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  responsibility_date DATE NOT NULL,
  note TEXT NOT NULL,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_shortage_responsibilities_branch_date
  ON branch_shortage_responsibilities(branch_id, responsibility_date, employee_id);

CREATE TABLE IF NOT EXISTS branch_shortage_responsibility_payments (
  id BIGSERIAL PRIMARY KEY,
  responsibility_id BIGINT NOT NULL REFERENCES branch_shortage_responsibilities(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  note TEXT,
  created_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_shortage_responsibility_payments_event_date
  ON branch_shortage_responsibility_payments(responsibility_id, payment_date, id);
