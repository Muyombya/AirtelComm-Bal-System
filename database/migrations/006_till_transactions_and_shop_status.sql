-- BUILD 006: Till transaction counts + General Shop Status saved fields/history
CREATE TABLE IF NOT EXISTS till_transaction_counts (
  id BIGSERIAL PRIMARY KEY,
  till_id BIGINT NOT NULL REFERENCES tills(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  service_key VARCHAR(50) NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0 CHECK (transaction_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(till_id, business_date, service_key)
);

CREATE INDEX IF NOT EXISTS idx_till_tx_counts_till_date
  ON till_transaction_counts(till_id, business_date);

CREATE TABLE IF NOT EXISTS general_shop_status_entries (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  accessories_count INTEGER NOT NULL DEFAULT 0 CHECK (accessories_count >= 0),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_general_shop_status_history
  ON general_shop_status_entries(branch_id, business_date DESC);

-- The earlier Build 005 table is no longer the source of truth for transaction counts.
-- It is intentionally retained for backward compatibility; new General Shop Status
-- reads counts from till_transaction_counts.
