BEGIN;
CREATE TABLE IF NOT EXISTS branch_terminal_allocations (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    terminal_id BIGINT NOT NULL REFERENCES terminals(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    released_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_branch_terminal_allocations_active_terminal
    ON branch_terminal_allocations(terminal_id) WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_branch_terminal_allocations_branch_active
    ON branch_terminal_allocations(branch_id, released_at, terminal_id);
INSERT INTO branch_terminal_allocations (branch_id, terminal_id, allocated_at)
SELECT DISTINCT ON (tt.terminal_id) t.branch_id, tt.terminal_id, COALESCE(tt.active_from, NOW())
FROM till_terminals tt JOIN tills t ON t.id=tt.till_id
WHERE tt.active_to IS NULL
  AND NOT EXISTS (SELECT 1 FROM branch_terminal_allocations bta WHERE bta.terminal_id=tt.terminal_id AND bta.released_at IS NULL)
ORDER BY tt.terminal_id, tt.id;
COMMIT;
