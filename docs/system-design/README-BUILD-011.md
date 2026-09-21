# BUILD 011 — General Shop Status Historical Retrieval

## Purpose
Make the General Shop Status Business Date a real daily archive selector.
Selecting an earlier business date reconstructs the General Shop Status from the
underlying historical Till balances, float positions, transaction counts,
Accessories entry, and shortage/payment records.

## Behaviour
- Current day remains editable for Accessories, Reason, and shortage payments.
- Dates before today are explicitly marked `HISTORICAL • READ ONLY`.
- Historical Accessories and Reason fields cannot be edited or saved.
- Historical shortage payments cannot be recorded.
- The date picker cannot select a future date.
- History Status rows are clickable; selecting a row loads that day's complete
  General Shop Status.
- Multiple Till balancing events on the same day resolve to the latest event per
  Till, preserving the existing daily-status behaviour.
- Historical branch operating capital uses the operating-capital value recorded
  by each Till's latest balance for that date, falling back to the configured Till
  capital only where that Till had no balance on the selected date. Such a day
  remains INCOMPLETE.
- History dates are sourced from Till balances, Till transaction counts, General
  Shop Status entries, and shortage payments so dates are not limited to only
  fully-balanced days.

## Files modified
- `client/src/components/GeneralShopStatus.jsx`
- `client/src/general-shop-status-correction.css`
- `server/src/controllers/generalShopStatusController.js`

## Files not touched
- Till Balancing
- Float Balances / drag-and-drop
- Terminal management
- API service
- Database schema / migrations
- Cash Book

## Database
No new migration is required. BUILD 009's `branch_shortage_payments` table is
used as-is.

## TEST
1. Open General Shop Status for today and confirm it remains editable.
2. Open the History Status section.
3. Click an older date.
4. Confirm the Business Date changes and the page reloads with that day's:
   - Closing Float
   - Till Transactions
   - Accessories Sales
   - Till Position
   - Branch Shortage Counter
   - Reason / capital status
5. Confirm the header shows `HISTORICAL • READ ONLY`.
6. Confirm Accessories, Reason, and shortage payment controls cannot modify data.
7. Return to today's date and confirm normal editing/payment controls return.
