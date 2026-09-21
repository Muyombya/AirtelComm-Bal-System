-- BUILD 003 refinement: persistent display order for Till float positions
ALTER TABLE till_terminals
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY till_id ORDER BY active_from, id) - 1 AS new_order
  FROM till_terminals
)
UPDATE till_terminals tt
SET sort_order = ranked.new_order
FROM ranked
WHERE tt.id = ranked.id
  AND tt.sort_order IS NULL;

ALTER TABLE till_terminals
  ALTER COLUMN sort_order SET DEFAULT 0;

ALTER TABLE till_terminals
  ALTER COLUMN sort_order SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_till_terminals_till_sort_order
  ON till_terminals(till_id, active_to, sort_order, id);
