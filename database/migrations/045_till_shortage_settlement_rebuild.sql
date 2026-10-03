BEGIN;

-- BUILD 045: Rebuild Till Shortage Settlement around explicit shortage events.
--
-- One authoritative shortage event is the latest SHORT balance for a Till on a
-- business date. Every repayment is allocated directly to that till_balance_id.
-- The original till_balances row is never modified by settlement activity.

CREATE OR REPLACE VIEW till_shortage_event_positions AS
WITH latest_shortage_events AS (
  SELECT DISTINCT ON (tb.till_id, tb.business_date)
         tb.id AS till_balance_id,
         tb.till_id,
         t.branch_id,
         tb.employee_id,
         e.name AS employee_name,
         t.name AS till_name,
         tb.business_date,
         tb.operating_capital,
         (-tb.difference)::NUMERIC(18,2) AS shortage
  FROM till_balances tb
  JOIN tills t ON t.id = tb.till_id
  JOIN employees e ON e.id = tb.employee_id
  WHERE tb.difference < 0
  ORDER BY tb.till_id, tb.business_date, tb.balanced_at DESC, tb.id DESC
),
allocated AS (
  SELECT till_balance_id,
         COALESCE(SUM(amount), 0)::NUMERIC(18,2) AS recovered
  FROM till_shortage_settlement_allocations
  GROUP BY till_balance_id
)
SELECT l.till_balance_id,
       l.till_id,
       l.branch_id,
       l.employee_id,
       l.employee_name,
       l.till_name,
       l.business_date,
       l.operating_capital,
       l.shortage,
       COALESCE(a.recovered, 0)::NUMERIC(18,2) AS recovered,
       GREATEST(l.shortage - COALESCE(a.recovered, 0), 0)::NUMERIC(18,2) AS outstanding
FROM latest_shortage_events l
LEFT JOIN allocated a ON a.till_balance_id = l.till_balance_id;

CREATE INDEX IF NOT EXISTS idx_till_shortage_alloc_balance_amount
  ON till_shortage_settlement_allocations(till_balance_id, amount);

COMMIT;
