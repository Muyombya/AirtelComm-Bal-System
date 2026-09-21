-- AirtelComm-Bal-System
-- Migration 038: Terminal Branch Assignment and Transfer History
-- A terminal must be assigned to a branch when it is registered.
-- Branch assignment history is retained when a terminal is transferred or removed.

BEGIN;

CREATE TABLE IF NOT EXISTS terminal_branch_assignments (
    id BIGSERIAL PRIMARY KEY,
    terminal_id BIGINT NOT NULL REFERENCES terminals(id),
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    active_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active_to TIMESTAMPTZ,
    CHECK (active_to IS NULL OR active_to > active_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_terminal_branch_active
    ON terminal_branch_assignments(terminal_id)
    WHERE active_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_terminal_branch_assignments_branch
    ON terminal_branch_assignments(branch_id, active_to, active_from);

CREATE INDEX IF NOT EXISTS idx_terminal_branch_assignments_terminal
    ON terminal_branch_assignments(terminal_id, active_to, active_from);

-- Backfill the current branch for existing terminals from their latest Till assignment.
-- This does not invent a branch for a terminal that has never been assigned to a Till.
INSERT INTO terminal_branch_assignments (terminal_id, branch_id, active_from)
SELECT t.id,
       latest.branch_id,
       COALESCE(latest.active_from, t.created_at)
FROM terminals t
JOIN LATERAL (
    SELECT ti.branch_id, tt.active_from
    FROM till_terminals tt
    JOIN tills ti ON ti.id = tt.till_id
    WHERE tt.terminal_id = t.id
    ORDER BY tt.active_from DESC, tt.id DESC
    LIMIT 1
) latest ON TRUE
WHERE NOT EXISTS (
    SELECT 1
    FROM terminal_branch_assignments existing
    WHERE existing.terminal_id = t.id
      AND existing.active_to IS NULL
);

COMMIT;
