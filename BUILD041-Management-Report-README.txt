BUILD 041 — Branch Management Report

This revision replaces the old Google-Sheet-derived General Shop Status presentation with a read-only management reporting page.

The page consolidates data already produced by:
- Till Balancing
- Cash Book
- Daily Terminal Transactions
- Branch Shortage / Recovery records
- General Shop Status history

Design principles:
- Reporting page is read-only; operational entries remain in their source modules.
- Cash Book status is now presented alongside Till position.
- Executive summary appears first.
- Till performance, Cash Book, terminal activity, float, shortages and management attention follow.
- Historical dates can be selected and are presented read-only.
- PRINT / SHARE uses the browser print dialog and includes print-specific styling.

No database migration is required for this presentation build.

Files:
client/src/components/GeneralShopStatus.jsx
client/src/management-report.css
server/src/controllers/generalShopStatusController.js
