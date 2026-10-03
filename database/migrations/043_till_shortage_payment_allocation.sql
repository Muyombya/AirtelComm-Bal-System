BEGIN;

-- BUILD 043: Tie shortage recovery payments to the Till whose shortage is being recovered.
ALTER TABLE branch_shortage_payments
  ADD COLUMN IF NOT EXISTS till_id BIGINT REFERENCES tills(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- Safely backfill legacy payments where the employee had exactly one Till assignment
-- active on the payment date. Ambiguous historical payments remain NULL and are preserved.
WITH candidates AS (
  SELECT bsp.id, MIN(ta.till_id) AS till_id
  FROM branch_shortage_payments bsp
  JOIN till_assignments ta
    ON ta.employee_id = bsp.employee_id
   AND ta.started_at::date <= bsp.payment_date
   AND (ta.ended_at IS NULL OR ta.ended_at::date >= bsp.payment_date)
  WHERE bsp.till_id IS NULL
  GROUP BY bsp.id
  HAVING COUNT(DISTINCT ta.till_id) = 1
)
UPDATE branch_shortage_payments bsp
SET till_id = c.till_id
FROM candidates c
WHERE bsp.id = c.id;

CREATE INDEX IF NOT EXISTS idx_branch_shortage_payments_till_date
  ON branch_shortage_payments(till_id, payment_date, id);

COMMIT;
