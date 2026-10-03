BUILD 045 — Till Shortage Settlement Final Package

Files included:
- server/src/controllers/tillBalanceController.js
- client/src/components/TillBalancing.jsx
- client/src/services/api.js

Purpose:
- Event-specific Till shortage settlement.
- Partial payments reduce only the selected shortage event.
- Same-day settlement is allowed.
- Later-day settlement is allowed.
- Settlement before the shortage event business date is rejected.
- Original Till balance remains unchanged by settlement.
- Settlement is recorded and allocated to the exact shortage event.
- API helper now passes businessDate to the balancing-context endpoint.

No new database migration is included. This package assumes the existing
shortage allocation ledger and Migration 045 view are already installed.

Suggested test:
1. Record a shortage on 2026-09-29.
2. Settle part of it on 2026-09-29. Confirm outstanding = shortage - payment.
3. Settle another part on 2026-09-30. Confirm outstanding reduces again.
4. Try a settlement date before 2026-09-29. Confirm it is rejected.
5. Confirm the original Balance History shortage remains unchanged.
