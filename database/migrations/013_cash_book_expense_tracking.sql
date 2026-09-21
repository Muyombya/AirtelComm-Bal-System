BEGIN;

CREATE TABLE IF NOT EXISTS cash_book_expense_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO cash_book_expense_categories (name) VALUES
('Allowance'),
('Internet'),
('Airtime'),
('Electricity'),
('Water'),
('Fuel'),
('Stationery / Printing'),
('Repairs / Maintenance'),
('Cleaning / Supplies'),
('Transport'),
('Other')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_cash_book_entries_branch_expense_category_date
    ON cash_book_entries(branch_id, entry_type, category, business_date);

COMMIT;
