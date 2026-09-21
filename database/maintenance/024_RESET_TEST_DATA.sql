-- AirtelComm-Bal-System
-- 024 - Clean Production-Candidate Database
--
-- PURPOSE:
-- Remove all test/business data while preserving the database schema and
-- master configuration tables that are intended to be reused (for example,
-- the standard Cash Book expense categories).
--
-- WARNING:
-- This is DESTRUCTIVE. It permanently deletes the current test records.
-- Do NOT run this against airtelcomm_bal_system if it contains real business
-- data. Do NOT run it against atlas_development.

BEGIN;

DO $$
DECLARE
    tbl TEXT;
    tables_to_clear TEXT[] := ARRAY[
        'cash_count_items',
        'float_balances',
        'till_transaction_counts',
        'general_shop_status_entries',
        'branch_shortage_payments',
        'cash_book_entries',
        'cash_book_accounts',
        'till_balances',
        'till_terminals',
        'till_assignments',
        'branch_terminal_allocations',
        'branch_float_allocations',
        'terminals',
        'tills',
        'employees',
        'service_providers',
        'branches'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables_to_clear LOOP
        IF to_regclass('public.' || tbl) IS NOT NULL THEN
            EXECUTE format('TRUNCATE TABLE public.%I RESTART IDENTITY CASCADE', tbl);
        END IF;
    END LOOP;
END $$;

COMMIT;

-- Verification: these should all return 0.
SELECT 'branches' AS table_name, COUNT(*) AS row_count FROM branches
UNION ALL SELECT 'tills', COUNT(*) FROM tills
UNION ALL SELECT 'employees', COUNT(*) FROM employees
UNION ALL SELECT 'service_providers', COUNT(*) FROM service_providers
UNION ALL SELECT 'terminals', COUNT(*) FROM terminals
UNION ALL SELECT 'till_assignments', COUNT(*) FROM till_assignments
UNION ALL SELECT 'till_terminals', COUNT(*) FROM till_terminals
UNION ALL SELECT 'till_balances', COUNT(*) FROM till_balances
UNION ALL SELECT 'cash_count_items', COUNT(*) FROM cash_count_items
UNION ALL SELECT 'float_balances', COUNT(*) FROM float_balances
UNION ALL SELECT 'till_transaction_counts', COUNT(*) FROM till_transaction_counts
UNION ALL SELECT 'general_shop_status_entries', COUNT(*) FROM general_shop_status_entries
UNION ALL SELECT 'branch_shortage_payments', COUNT(*) FROM branch_shortage_payments
UNION ALL SELECT 'cash_book_entries', COUNT(*) FROM cash_book_entries
UNION ALL SELECT 'cash_book_accounts', COUNT(*) FROM cash_book_accounts
ORDER BY table_name;
