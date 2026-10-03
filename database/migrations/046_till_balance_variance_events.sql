BEGIN;

-- BUILD 046
-- Every Record Balance remains in till_balances. These two fields record only
-- the NEW shortage/excess created by that balancing session compared with the
-- immediately preceding recorded session for the same Till.
ALTER TABLE till_balances
  ADD COLUMN IF NOT EXISTS shortage_event_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS excess_event_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

-- Backfill existing history using recording order. If an older settlement was
-- already allocated to a historical balance, preserve enough event value to
-- keep that existing settlement auditable after the rebuild.
WITH ordered AS (
  SELECT
    tb.id,
    tb.till_id,
    tb.difference,
    LAG(tb.difference) OVER (
      PARTITION BY tb.till_id
      ORDER BY tb.balanced_at ASC, tb.id ASC
    ) AS previous_difference
  FROM till_balances tb
), calculated AS (
  SELECT
    id,
    CASE
      WHEN difference < 0 THEN GREATEST(
        ABS(difference) - CASE WHEN COALESCE(previous_difference, 0) < 0 THEN ABS(previous_difference) ELSE 0 END,
        0
      )
      ELSE 0
    END::NUMERIC(18,2) AS shortage_event_amount,
    CASE
      WHEN difference > 0 THEN GREATEST(
        difference - CASE WHEN COALESCE(previous_difference, 0) > 0 THEN previous_difference ELSE 0 END,
        0
      )
      ELSE 0
    END::NUMERIC(18,2) AS excess_event_amount
  FROM ordered
), allocated AS (
  SELECT
    till_balance_id AS id,
    COALESCE(SUM(amount), 0)::NUMERIC(18,2) AS allocated_amount
  FROM till_shortage_settlement_allocations
  GROUP BY till_balance_id
)
UPDATE till_balances tb
SET shortage_event_amount = GREATEST(c.shortage_event_amount, COALESCE(a.allocated_amount, 0))::NUMERIC(18,2),
    excess_event_amount = c.excess_event_amount
FROM calculated c
LEFT JOIN allocated a ON a.id = c.id
WHERE tb.id = c.id;

CREATE INDEX IF NOT EXISTS idx_till_balances_till_recorded_order
  ON till_balances(till_id, balanced_at DESC, id DESC);

-- The authoritative shortage event is now the NEW shortage created by a
-- balancing session, not the full repeated SHORT difference.
--
-- Migration 045 already created this view. PostgreSQL does not allow
-- CREATE OR REPLACE VIEW to change an existing view column name/order.
-- Drop and recreate it inside this transaction so 046 can be applied cleanly.
DROP VIEW IF EXISTS till_shortage_event_positions;

CREATE VIEW till_shortage_event_positions AS
WITH allocated AS (
  SELECT
    till_balance_id,
    COALESCE(SUM(amount), 0)::NUMERIC(18,2) AS recovered
  FROM till_shortage_settlement_allocations
  GROUP BY till_balance_id
)
SELECT
  tb.id AS till_balance_id,
  tb.till_id,
  t.branch_id,
  tb.employee_id,
  e.name AS employee_name,
  t.name AS till_name,
  tb.business_date,
  tb.operating_capital,
  tb.shortage_event_amount AS shortage,
  CASE WHEN tb.difference < 0 THEN ABS(tb.difference) ELSE 0 END::NUMERIC(18,2) AS observed_shortage,
  COALESCE(a.recovered, 0)::NUMERIC(18,2) AS recovered,
  GREATEST(tb.shortage_event_amount - COALESCE(a.recovered, 0), 0)::NUMERIC(18,2) AS outstanding
FROM till_balances tb
JOIN tills t ON t.id = tb.till_id
JOIN employees e ON e.id = tb.employee_id
LEFT JOIN allocated a ON a.till_balance_id = tb.id
WHERE tb.shortage_event_amount > 0;

COMMIT;
