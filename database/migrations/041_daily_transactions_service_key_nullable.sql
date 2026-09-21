-- AirtelComm-Bal-System - Migration 041
-- BUILD 040 compatibility: terminal-based transaction counts no longer require service_key.

BEGIN;

ALTER TABLE till_transaction_counts
    ALTER COLUMN service_key DROP NOT NULL;

COMMIT;