-- AirtelComm-Bal-System
-- Seed 001: initial Kitende master data from the workbook.
-- Terminal IDs/account numbers are intentionally NOT invented here.

BEGIN;

INSERT INTO branches (name, operating_capital)
VALUES ('Kitende Branch', 104600000)
ON CONFLICT (name) DO UPDATE
SET operating_capital = EXCLUDED.operating_capital, updated_at = NOW();

INSERT INTO employees (name)
SELECT x.name
FROM (VALUES ('Prossy'), ('Joan'), ('Shallon')) AS x(name)
WHERE NOT EXISTS (
    SELECT 1 FROM employees e WHERE lower(e.name) = lower(x.name)
);

INSERT INTO tills (branch_id, name, operating_capital)
SELECT b.id, x.name, x.operating_capital
FROM branches b
CROSS JOIN (VALUES
    ('Till Prossy', 25000000::NUMERIC),
    ('Till Joan', 32600000::NUMERIC),
    ('Till Shallon', 47000000::NUMERIC)
) AS x(name, operating_capital)
WHERE b.name = 'Kitende Branch'
ON CONFLICT (branch_id, name) DO UPDATE
SET operating_capital = EXCLUDED.operating_capital, updated_at = NOW();

INSERT INTO service_providers (name)
SELECT x.name
FROM (VALUES
    ('MTN'), ('Airtel'), ('Payway'), ('Centenary'),
    ('Equity'), ('DFCU'), ('Absa'), ('Stanbic')
) AS x(name)
WHERE NOT EXISTS (
    SELECT 1 FROM service_providers sp WHERE lower(sp.name) = lower(x.name)
);

INSERT INTO till_assignments (till_id, employee_id, started_at)
SELECT t.id, e.id, NOW()
FROM tills t
JOIN employees e
  ON lower(e.name) = lower(
       CASE t.name
         WHEN 'Till Prossy' THEN 'Prossy'
         WHEN 'Till Joan' THEN 'Joan'
         WHEN 'Till Shallon' THEN 'Shallon'
       END
     )
JOIN branches b ON b.id = t.branch_id
WHERE b.name = 'Kitende Branch'
  AND t.name IN ('Till Prossy', 'Till Joan', 'Till Shallon')
  AND NOT EXISTS (
      SELECT 1 FROM till_assignments ta
      WHERE ta.till_id = t.id
        AND ta.employee_id = e.id
        AND ta.ended_at IS NULL
  );

COMMIT;
