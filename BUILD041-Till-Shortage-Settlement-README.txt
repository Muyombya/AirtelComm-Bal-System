BUILD 041 — Till Shortage Settlement

Purpose
-------
Adds an explicit shortage-settlement workflow to Till Balancing so an employee can repay a shortage carried from an earlier balancing date.

Workflow
--------
1. A previous Till shortage remains in the historical Till Balance record.
2. On a later business date, Till Balancing displays the previous outstanding shortage for the current Till attendant.
3. The attendant/supervisor/manager can record a full or partial settlement.
4. The settlement is stored in branch_shortage_payments and is immediately visible to General Shop Status.
5. A fully settled previous shortage displays UGX 0 outstanding; the historical SHORT record is not altered or deleted.
6. The settlement does NOT change today's physical Till cash/float calculation. It is a separate recovery event.

Included files
--------------
server/src/controllers/tillBalanceController.js
server/src/routes/tillBalanceRoutes.js
client/src/components/TillBalancing.jsx
client/src/services/api.js
client/src/till-balancing.css
server/src/controllers/generalShopStatusController.js
client/src/components/GeneralShopStatus.jsx
client/src/management-report.css

Database migration
------------------
No new migration is required. The workflow uses the existing branch_shortage_payments table created by migration 009.

Testing sequence
----------------
1. Create a SHORT Till Balance for a test date.
2. Move to the next business date.
3. Confirm Previous Till Shortage shows the outstanding amount.
4. Click Settle Shortage.
5. Test a partial payment and confirm the remaining balance.
6. Test the final payment and confirm outstanding becomes UGX 0.
7. Open General Shop Status for the settlement date and confirm the shortage balance is cleared while the recovery appears in payment history.
8. Confirm the original historical SHORT Till Balance remains unchanged.

Do not commit until this complete lifecycle passes local testing.
