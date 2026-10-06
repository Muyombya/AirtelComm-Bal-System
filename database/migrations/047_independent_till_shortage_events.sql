BEGIN;

-- BUILD 047
-- Shortage events are independent balancing events. A SHORT Till Balance
-- creates an event equal to its full observed shortage. A later balancing
-- event must never subtract an earlier physical shortage from its own event
-- amount; recoveries are represented only by explicit settlement allocations.
--
-- This corrects existing rows produced by BUILD 046, whose backfill used the
-- previous Till Balance difference to derive the event amount.

UPDATE till_balances
SET shortage_event_amount = CASE
  WHEN difference < 0 THEN ABS(difference)::NUMERIC(18,2)
  ELSE 0::NUMERIC(18,2)
END
WHERE shortage_event_amount <> CASE
  WHEN difference < 0 THEN ABS(difference)::NUMERIC(18,2)
  ELSE 0::NUMERIC(18,2)
END;

-- Recreate the authoritative event view so its definition remains explicitly
-- aligned with the independent-event rule and settlement allocations.
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
