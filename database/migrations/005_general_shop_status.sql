CREATE TABLE IF NOT EXISTS shop_status_transaction_counts (
  id BIGSERIAL PRIMARY KEY,
  branch_id BIGINT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  business_date DATE NOT NULL,
  service_key VARCHAR(50) NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0 CHECK (transaction_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, business_date, service_key)
);

CREATE INDEX IF NOT EXISTS idx_shop_status_tx_branch_date
  ON shop_status_transaction_counts(branch_id, business_date);
