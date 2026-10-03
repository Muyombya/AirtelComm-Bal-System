BUILD 041 — Till Shortage Management Fix

This package supersedes the previous BUILD 041 Till Shortage Settlement package.

WHAT IS FIXED
--------------
1. Renames “Previous Till Shortage” to “Till Shortage Counter”.
2. Renames the settlement dialog to “Settle Till Shortage”.
3. Shortage recovery payments are now tied to the specific Till.
4. The Till shortage counter includes the current business date, so a newly recorded SHORT immediately becomes shortage exposure.
5. Partial payments remain partial. Example:
      Shortage: UGX 1,006,146
      Payment:  UGX 1,000,000
      Balance:  UGX 6,146
6. The backend calculates the remaining balance from the exact Till debt and exact Till recovery payments.
7. Existing historical payment rows are safely backfilled to a Till when the employee had exactly one Till assignment active on the payment date. Ambiguous historical rows remain preserved rather than being guessed.
8. Effective working capital is displayed separately:
      Effective Working Capital = Operating Capital - Outstanding Shortage
   This does NOT alter the physical Till balancing benchmark or today's physical cash count.
9. General Shop Status remains a reporting page. Its shortage section is now labelled “Till Shortage Counter” and reports shortage exposure/recovery.
10. Shortage payment history includes the Till when available.

DATABASE
--------
Migration 043 is included:
server/database/migrations/043_till_shortage_payment_allocation.sql
database/migrations/044_till_shortage_settlement_allocations.sql

Run this migration once in the target database before testing the new settlement workflow.

TEST SEQUENCE
-------------
1. Apply migration 043.
2. Create a Till Balance SHORT of exactly UGX 1,006,146.
3. Confirm Till Shortage Counter shows outstanding UGX 1,006,146.
4. Record a settlement of UGX 1,000,000.
5. Confirm the response and counter show UGX 6,146 outstanding — NOT settled.
6. Confirm Effective Working Capital is Operating Capital minus UGX 6,146.
7. Record the final UGX 6,146 settlement.
8. Confirm outstanding becomes UGX 0 and the counter shows SETTLED.
9. Confirm the original historical Till Balance remains SHORT at UGX 1,006,146.
10. Open General Shop Status and confirm the recovery is reported and the outstanding shortage is zero.
11. Repeat with a partial payment that is less than the shortage and confirm the remaining debt is exact.

IMPORTANT
---------
The shortage recovery is a separate financial recovery event. It does not add money to today's physical Till count automatically.


BUILD 041 — Shortage Settlement Allocation Correction
-----------------------------------------------------
Migration 044 introduces an explicit allocation ledger. Each shortage recovery payment is allocated to one or more specific Till Balance shortage events in FIFO order.

This prevents employee-level or aggregate payment calculations from incorrectly marking a partial payment as fully settled. Example: a UGX 1,006,146 shortage with a UGX 1,000,000 payment leaves UGX 6,146 outstanding.

Migration order
---------------
Run 043 first, then 044. Do not run 044 before 043.

Working capital
---------------
Effective working capital is Operating Capital minus the current outstanding shortage. Shortage recovery reduces the outstanding exposure but does not automatically increase today's physical Till cash.

Testing
-------
1. Create a shortage of UGX 1,006,146.
2. On a later business date record a UGX 1,000,000 settlement.
3. Confirm the system reports UGX 6,146 outstanding and does not say SETTLED.
4. Record UGX 6,146.
5. Confirm outstanding becomes UGX 0 and the counter shows SETTLED.
6. Confirm the original shortage balance remains historically unchanged.
7. Confirm General Shop Status shows the recovery and the remaining/current shortage correctly.
