-- BUILD 046 verification
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='till_balances'
  AND column_name IN ('shortage_event_amount','excess_event_amount')
ORDER BY column_name;

SELECT id, till_id, business_date, difference, status,
       shortage_event_amount, excess_event_amount
FROM till_balances
ORDER BY till_id, balanced_at, id;

SELECT till_balance_id, till_id, business_date, shortage,
       observed_shortage, recovered, outstanding
FROM till_shortage_event_positions
ORDER BY till_id, business_date, till_balance_id;
