-- AirtelComm-Bal-System - Migration 040
-- Daily transaction counts are stored against the actual Terminal.
-- Existing legacy/provider-based transaction records are preserved.

BEGIN;

ALTER TABLE till_transaction_counts
    ADD COLUMN IF NOT EXISTS terminal_id INTEGER;

ALTER TABLE till_transaction_counts
    DROP CONSTRAINT IF EXISTS till_transaction_counts_terminal_id_fkey;

ALTER TABLE till_transaction_counts
    ADD CONSTRAINT till_transaction_counts_terminal_id_fkey
    FOREIGN KEY (terminal_id)
    REFERENCES terminals(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_till_transaction_counts_till_date_terminal
    ON till_transaction_counts (till_id, business_date, terminal_id)
    WHERE terminal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_till_transaction_counts_terminal_date
    ON till_transaction_counts (terminal_id, business_date)
    WHERE terminal_id IS NOT NULL;

COMMIT;
