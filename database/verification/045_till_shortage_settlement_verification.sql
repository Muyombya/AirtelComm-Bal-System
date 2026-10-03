-- BUILD 045 verification queries.
-- Replace :till_id with the Till under test in your SQL client.

-- 1. Show every shortage event and its calculated outstanding amount.
SELECT
  till_balance_id,
  till_id,
  business_date,
  employee_name,
  shortage,
  recovered,
  outstanding
FROM till_shortage_event_positions
WHERE till_id = :till_id
ORDER BY business_date, till_balance_id;

-- 2. Show settlement records exactly as stored.
SELECT
  bsp.id,
  bsp.till_id,
  bsp.employee_id,
  e.name AS employee_name,
  bsp.amount,
  bsp.payment_date,
  bsp.note,
  bsp.created_at
FROM branch_shortage_payments bsp
JOIN employees e ON e.id = bsp.employee_id
WHERE bsp.till_id = :till_id
ORDER BY bsp.payment_date, bsp.id;

-- 3. Show allocation ledger.
SELECT
  a.id,
  a.payment_id,
  a.till_balance_id,
  a.amount,
  a.created_at
FROM till_shortage_settlement_allocations a
JOIN till_balances tb ON tb.id = a.till_balance_id
WHERE tb.till_id = :till_id
ORDER BY a.id;

-- 4. Mathematical check for the Till.
SELECT
  COALESCE(SUM(shortage),0) AS total_shortage,
  COALESCE(SUM(recovered),0) AS total_recovered,
  COALESCE(SUM(outstanding),0) AS total_outstanding
FROM till_shortage_event_positions
WHERE till_id = :till_id;
