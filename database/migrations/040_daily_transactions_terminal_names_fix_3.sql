-- AirtelComm-Bal-System - BUILD 040 FIX 3
-- Fixes PostgreSQL ON CONFLICT inference for terminal-based daily transactions.

BEGIN;

DROP INDEX IF EXISTS uq_till_transaction_counts_till_date_terminal;

CREATE UNIQUE INDEX IF NOT EXISTS uq_till_transaction_counts_till_date_terminal
    ON till_transaction_counts (till_id, business_date, terminal_id);

COMMIT;
