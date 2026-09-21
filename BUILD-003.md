# BUILD 003 — Till Balancing

## Purpose

Implement the first operational Till balancing workflow based on the agreed Excel process:

1. Select an active Till.
2. Resolve its currently assigned attendant.
3. Show the Till Operating Capital.
4. Count physical cash by denomination, plus BATCH and COINS.
5. Show only active terminals assigned to that Till and enter each current float balance.
6. Calculate Total Cash, Total Float, Actual Till Capital, Difference and Status.
7. Save every balancing event as a separate historical record.

## Status rules

- Actual Till Capital < Operating Capital → SHORT
- Actual Till Capital = Operating Capital → BALANCED
- Actual Till Capital > Operating Capital → EXCESS

## Files

### NEW
- database/migrations/003_till_balancing_indexes.sql
- server/src/controllers/tillBalanceController.js
- server/src/routes/tillBalanceRoutes.js
- client/src/components/TillBalancing.jsx

### UPDATED
- server/src/app.js
- client/src/App.jsx
- client/src/index.css
- client/src/services/api.js

### UNCHANGED
- database/migrations/001_initial_till_balancing.sql
- database/seeds/001_initial_kitende_master_data.sql
- existing terminal migration 002
- existing terminal controller/routes functionality
- PostgreSQL data
- atlas_development database

## Migration

Run once from the project root:

psql -U postgres -d airtelcomm_bal_system -f database/migrations/003_till_balancing_indexes.sql

Do not rerun migrations 001 or 002.

## GUI test order

1. Open Till Balancing.
2. Confirm active Tills and attendant load.
3. Confirm Operating Capital for Till Prossy is UGX 25,000,000.
4. Confirm no active terminals are shown for Till Prossy after Build 002 cleanup.
5. Enter a controlled test cash count and verify the live Total Cash calculation.
6. Create a test balance with zero float and verify SHORT/BALANCED/EXCESS calculation.
7. Confirm a saved event appears in Balance History.
8. Repeat with another controlled event to prove multiple balances do not overwrite each other.

Real terminal assignments should not be entered until the balancing screen is confirmed.
