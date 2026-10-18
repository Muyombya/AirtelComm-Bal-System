-- Associate workers directly with branches, whether or not they have a Till.
CREATE TABLE IF NOT EXISTS branch_employees (
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (branch_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_branch_employees_employee
  ON branch_employees(employee_id, branch_id);

-- Existing Till attendants are already branch workers. Preserve that
-- relationship when they are later unassigned from a Till.
INSERT INTO branch_employees(branch_id, employee_id)
SELECT DISTINCT t.branch_id, ta.employee_id
FROM till_assignments ta
JOIN tills t ON t.id=ta.till_id
WHERE ta.ended_at IS NULL
ON CONFLICT (branch_id, employee_id) DO NOTHING;
