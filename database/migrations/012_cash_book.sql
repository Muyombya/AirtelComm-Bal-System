BEGIN;

CREATE TABLE IF NOT EXISTS cash_book_accounts (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
    opening_set_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (branch_id)
);

CREATE TABLE IF NOT EXISTS cash_book_entries (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT NOT NULL REFERENCES branches(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN ('TOP_UP','EXPENSE')),
    amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    category VARCHAR(100),
    description TEXT NOT NULL,
    reference VARCHAR(120),
    business_date DATE NOT NULL,
    entered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cash_book_entries_branch_date
    ON cash_book_entries(branch_id, business_date, entered_at, id);

CREATE INDEX IF NOT EXISTS idx_cash_book_entries_branch_type
    ON cash_book_entries(branch_id, entry_type, business_date);

INSERT INTO cash_book_accounts (branch_id)
SELECT id FROM branches
WHERE NOT EXISTS (
    SELECT 1 FROM cash_book_accounts cba WHERE cba.branch_id = branches.id
);

COMMIT;
