-- AirtelComm-Bal-System
-- Migration: 001_initial_till_balancing.sql
-- Purpose: foundational entities and Till Balancing records.
-- No branch-status, shortage, cash-book, or network-claim tables yet.

CREATE TABLE IF NOT EXISTS branches (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    contact VARCHAR(50),
    email VARCHAR(255),
    location VARCHAR(255),
    operating_capital NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (operating_capital >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    contact VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tills (
    id BIGSERIAL PRIMARY KEY,
    branch_id BIGINT NOT NULL REFERENCES branches(id),
    name VARCHAR(100) NOT NULL,
    operating_capital NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (operating_capital >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (branch_id, name)
);

CREATE TABLE IF NOT EXISTS till_assignments (
    id BIGSERIAL PRIMARY KEY,
    till_id BIGINT NOT NULL REFERENCES tills(id),
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_till_assignments_till
    ON till_assignments(till_id);

CREATE INDEX IF NOT EXISTS idx_till_assignments_employee
    ON till_assignments(employee_id);

CREATE TABLE IF NOT EXISTS service_providers (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    supervisor_name VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS terminals (
    id BIGSERIAL PRIMARY KEY,
    service_provider_id BIGINT NOT NULL REFERENCES service_providers(id),
    name VARCHAR(150) NOT NULL,
    outlet_id VARCHAR(100),
    account_number VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS till_terminals (
    id BIGSERIAL PRIMARY KEY,
    till_id BIGINT NOT NULL REFERENCES tills(id),
    terminal_id BIGINT NOT NULL REFERENCES terminals(id),
    active_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active_to TIMESTAMPTZ,
    CHECK (active_to IS NULL OR active_to > active_from),
    UNIQUE (till_id, terminal_id, active_from)
);

CREATE INDEX IF NOT EXISTS idx_till_terminals_till
    ON till_terminals(till_id);

CREATE TABLE IF NOT EXISTS till_balances (
    id BIGSERIAL PRIMARY KEY,
    till_id BIGINT NOT NULL REFERENCES tills(id),
    employee_id BIGINT REFERENCES employees(id),
    business_date DATE NOT NULL,
    balanced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    operating_capital NUMERIC(18,2) NOT NULL CHECK (operating_capital >= 0),
    total_cash NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_cash >= 0),
    total_float NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_float >= 0),
    actual_till_capital NUMERIC(18,2) NOT NULL DEFAULT 0,
    difference NUMERIC(18,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'BALANCED'
        CHECK (status IN ('SHORT', 'BALANCED', 'EXCESS')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_till_balances_till_date
    ON till_balances(till_id, business_date);

CREATE INDEX IF NOT EXISTS idx_till_balances_balanced_at
    ON till_balances(balanced_at);

CREATE TABLE IF NOT EXISTS cash_count_items (
    id BIGSERIAL PRIMARY KEY,
    till_balance_id BIGINT NOT NULL REFERENCES till_balances(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL
        CHECK (item_type IN ('DENOMINATION', 'BATCH', 'COINS')),
    denomination NUMERIC(18,2),
    quantity INTEGER,
    amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
    CHECK (
        (item_type = 'DENOMINATION' AND denomination IS NOT NULL AND denomination > 0 AND quantity IS NOT NULL AND quantity >= 0)
        OR
        (item_type IN ('BATCH', 'COINS') AND amount >= 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_cash_count_items_balance
    ON cash_count_items(till_balance_id);

CREATE TABLE IF NOT EXISTS float_balances (
    id BIGSERIAL PRIMARY KEY,
    till_balance_id BIGINT NOT NULL REFERENCES till_balances(id) ON DELETE CASCADE,
    terminal_id BIGINT NOT NULL REFERENCES terminals(id),
    service_provider_id BIGINT NOT NULL REFERENCES service_providers(id),
    amount NUMERIC(18,2) NOT NULL CHECK (amount >= 0),
    UNIQUE (till_balance_id, terminal_id)
);

CREATE INDEX IF NOT EXISTS idx_float_balances_balance
    ON float_balances(till_balance_id);

CREATE INDEX IF NOT EXISTS idx_float_balances_terminal
    ON float_balances(terminal_id);
