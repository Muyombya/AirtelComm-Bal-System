BUILD 045 DATE-HANDOFF FIX

Purpose
-------
Correct the Till Shortage Settlement date flow so the settlement date is an
explicit user-controlled business date rather than silently reusing the
Till Balancing business-date state.

Rules
-----
1. Settlement date may equal the shortage event business date.
2. Settlement date may be later than the shortage event business date.
3. Settlement date may not be earlier than the shortage event business date.
4. The original till_balances shortage event is never modified by settlement.
5. The settlement amount is allocated directly to the selected shortage event.
6. Partial settlement remains outstanding until the full event shortage is
   allocated.

Test scenario
-------------
Shortage event: 2026-09-29
Shortage amount: UGX 5,158,122
Settlement date: 2026-09-30
Settlement amount: UGX 5,000,000
Expected outstanding: UGX 158,122

Integration
-----------
Replace these complete files from this package in the project:
- client/src/components/TillBalancing.jsx
- server/src/controllers/tillBalanceController.js

No new database migration is required for this date-handoff fix.
