-- Initial reference data from the current Kitende workbook.
-- This is deliberately minimal: one branch only.
INSERT INTO branches (name)
VALUES ('Kitende Branch')
ON CONFLICT (name) DO NOTHING;
