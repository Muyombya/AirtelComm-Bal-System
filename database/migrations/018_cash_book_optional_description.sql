BEGIN;

ALTER TABLE cash_book_entries
    ALTER COLUMN description DROP NOT NULL;

COMMIT;
