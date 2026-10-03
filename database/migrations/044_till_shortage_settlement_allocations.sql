BEGIN;

-- BUILD 044: Make shortage recovery an explicit allocation ledger.
-- A payment is a recovery event; allocations identify exactly which Till Balance
-- shortage event(s) that payment settles. This prevents a partial payment from
-- being mistaken for full settlement through employee-level aggregation.

CREATE TABLE IF NOT EXISTS till_shortage_settlement_allocations (
  id BIGSERIAL PRIMARY KEY,
  payment_id BIGINT NOT NULL REFERENCES branch_shortage_payments(id) ON DELETE CASCADE,
  till_balance_id BIGINT NOT NULL REFERENCES till_balances(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(payment_id, till_balance_id)
);

CREATE INDEX IF NOT EXISTS idx_till_shortage_alloc_balance
  ON till_shortage_settlement_allocations(till_balance_id);

CREATE INDEX IF NOT EXISTS idx_till_shortage_alloc_payment
  ON till_shortage_settlement_allocations(payment_id);

-- Backfill existing Till-linked payments against historical shortage events in
-- FIFO order. Ambiguous payments without a till_id remain untouched and are
-- deliberately preserved for audit purposes.
DO $$
DECLARE
  p RECORD;
  s RECORD;
  remaining NUMERIC(18,2);
  available NUMERIC(18,2);
  allocation NUMERIC(18,2);
BEGIN
  FOR p IN
    SELECT bsp.id, bsp.till_id, bsp.employee_id, bsp.amount, bsp.payment_date
    FROM branch_shortage_payments bsp
    WHERE bsp.till_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM till_shortage_settlement_allocations a
        WHERE a.payment_id = bsp.id
      )
    ORDER BY bsp.payment_date, bsp.id
  LOOP
    remaining := p.amount;

    FOR s IN
      WITH latest AS (
        SELECT DISTINCT ON (tb.till_id, tb.business_date)
               tb.id, tb.business_date, tb.difference
        FROM till_balances tb
        WHERE tb.till_id = p.till_id
          AND tb.employee_id = p.employee_id
          AND tb.business_date <= p.payment_date
          AND tb.difference < 0
        ORDER BY tb.till_id, tb.business_date, tb.balanced_at DESC, tb.id DESC
      )
      SELECT latest.id AS till_balance_id,
             (-latest.difference)::NUMERIC(18,2) AS shortage,
             COALESCE(SUM(a.amount),0)::NUMERIC(18,2) AS allocated
      FROM latest
      LEFT JOIN till_shortage_settlement_allocations a
        ON a.till_balance_id = latest.id
      GROUP BY latest.id, latest.business_date, latest.difference
      HAVING (-latest.difference) - COALESCE(SUM(a.amount),0) > 0
      ORDER BY latest.business_date, latest.id
    LOOP
      EXIT WHEN remaining <= 0;
      available := GREATEST(s.shortage - s.allocated, 0);
      allocation := LEAST(remaining, available);
      IF allocation > 0 THEN
        INSERT INTO till_shortage_settlement_allocations(payment_id, till_balance_id, amount)
        VALUES (p.id, s.till_balance_id, allocation);
        remaining := remaining - allocation;
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
