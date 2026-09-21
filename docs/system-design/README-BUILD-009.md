# BUILD 009 — General Shop Status layout + Branch Shortage Counter

## Purpose
Reworks General Shop Status to closely follow the compact Excel layout and adds Branch Shortage Counter.

## Apply
1. Run `database/migrations/009_branch_shortage_counter.sql` in PostgreSQL.
2. Replace `server/src/controllers/generalShopStatusController.js`.
3. Replace `server/src/routes/generalShopStatusRoutes.js`.
4. Replace `server/src/app.js` only if your current app.js does not already mount `generalShopStatusRoutes` under `/api`. This copy preserves the existing route mounts.
5. Replace `client/src/components/GeneralShopStatus.jsx`.
6. Replace `client/src/services/api.js` with the included API file so the existing Till/Terminal APIs remain available and `recordShortagePayment` is added.
7. Replace `client/src/general-shop-status-correction.css` and ensure `index.css` imports it once.

## Shortage accounting rule
- `Added` is automatic: it is the fresh shortage created by SHORT Till balance events for the selected business date.
- `Amount Owed` is cumulative shortage created up to the selected date.
- `Paid Off` is cumulative recorded payments up to the selected date.
- `Balance = Amount Owed - Paid Off`.
- A payment is an immutable ledger entry; it does not erase the shortage history.
- Outstanding shortage is treated as a receivable. Therefore `Adjusted Branch Capital = physical Branch Capital + outstanding shortage receivable`.
- The raw branch imbalance remains visible, while Adjusted Imbalance shows the position after recognizing the receivable.

## Cash Book
Cash Book is deliberately NOT included. It remains a separate future module.
