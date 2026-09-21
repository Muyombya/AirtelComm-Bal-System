-- AirtelComm-Bal-System
-- Migration 002: Terminal Master Data support
-- Existing terminal and Till-terminal tables were created by migration 001.
-- This migration adds indexes only. No existing data is deleted or changed.

CREATE INDEX IF NOT EXISTS idx_terminals_provider_status
    ON terminals(service_provider_id, status);

CREATE INDEX IF NOT EXISTS idx_terminals_name
    ON terminals(name);

CREATE INDEX IF NOT EXISTS idx_till_terminals_till_active_window
    ON till_terminals(till_id, active_from, active_to);
