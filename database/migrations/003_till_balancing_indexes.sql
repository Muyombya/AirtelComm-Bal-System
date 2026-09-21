-- BUILD 003: Till Balancing
-- Adds supporting indexes only. No existing data is changed.

CREATE INDEX IF NOT EXISTS idx_till_balances_till_date_time
    ON till_balances(till_id, business_date, balanced_at DESC);

CREATE INDEX IF NOT EXISTS idx_cash_count_items_balance
    ON cash_count_items(till_balance_id);

CREATE INDEX IF NOT EXISTS idx_float_balances_balance
    ON float_balances(till_balance_id);
