BUILD 046 — Branch Performance Status Live Data Synchronization

Purpose
-------
Make Branch Performance Status a complete, dynamically refreshed management statement.
A successful persisted change to a Till or related financial record now triggers a refresh of the COMPLETE branch report rather than updating only the section that initiated the change.

Key behavior
------------
1. Record Balance on a Till:
   - The database write completes first.
   - Branch Performance Status receives a live-change event.
   - The complete report is fetched again.
   - Branch Operating Position, Adjusted Position, Till Performance, Daily Transactions,
     Closing Float, Shortage & Recovery, Management Attention, and other report sections
     are therefore calculated from the same current database state.

2. Till Shortage Settlement:
   - The settlement and allocation are committed first.
   - The complete report is immediately refreshed.
   - Recovered and outstanding shortage values therefore stay consistent with the other
     affected report sections.

3. Till transaction counts:
   - Direct transaction-count saves also invalidate the report.

4. Cash Book:
   - Opening-balance and Cash Book entry saves invalidate the report as well.

5. Cross-tab support:
   - A browser CustomEvent updates the report immediately inside the current tab.
   - localStorage is also used as a cross-tab signal, so a report opened in another browser
     tab can refresh when a Till operation is completed elsewhere.

6. Navigation/focus safety:
   - The report fetches fresh data whenever its branch/date changes.
   - Returning to the browser window or tab triggers a silent full refresh.
   - A request sequence guard prevents an older HTTP response from overwriting a newer report.

Important accounting behavior
-----------------------------
This build does NOT turn a shortage repayment into physical Till cash. The original Till
balance remains the historical physical count. Settlement changes the recovery/allocation
position. The Branch Performance Status therefore reads all sections again from the same
persisted state instead of artificially rewriting the Till's historical physical balance.

Files
-----
client/src/components/GeneralShopStatus.jsx
client/src/components/TillBalancing.jsx
client/src/services/api.js
client/src/services/branchReportEvents.js
client/src/branch-performance-status.css
server/src/controllers/generalShopStatusController.js

Database
--------
No database migration is required for this live-refresh build.
It relies on the existing Till shortage settlement/allocation structure and the existing
Branch Performance Status report endpoint.

Integration
-----------
Replace the corresponding files in the project with the files in this package.
Do not combine this TillBalancing.jsx with an older TillBalancing file: the supplied file
already preserves the BUILD 045 ordering and shortage-settlement behavior.

Validation performed
--------------------
- Node syntax check passed for api.js.
- Node syntax check passed for branchReportEvents.js.
- Node syntax check passed for generalShopStatusController.js.
- TypeScript parser JSX syntax check passed for GeneralShopStatus.jsx.
- TypeScript parser JSX syntax check passed for TillBalancing.jsx.
- A full Vite production build was not run in the build environment because the project
  dependencies are not present locally and npx esbuild timed out. The supplied JSX files
  were nevertheless parser-validated.

Recommended test
----------------
A. Open Branch Performance Status in one browser tab.
B. Open Till Balancing in another tab using the same branch.
C. Record a Till Balance.
D. Return to the report tab and confirm the entire statement updates, not only Shortage & Recovery.
E. Make a partial shortage settlement.
F. Confirm recovered/outstanding shortage, Adjusted Position, Till Performance, and Management
   Attention all represent the same new database state.
G. Add a Cash Book entry and confirm the Cash Book section refreshes too.
