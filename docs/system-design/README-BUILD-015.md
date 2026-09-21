# AirtelComm-Bal-System — BUILD 015
## Master Data & Dynamic Branch Setup

Purpose: remove remaining hardcoded branch assumptions and provide database-managed master data for branches, tills, operating capital, employees and service providers.

### Files added
- server/src/controllers/masterDataController.js
- server/src/routes/masterDataRoutes.js
- client/src/components/MasterData.jsx
- client/src/master-data.css

### Files modified
- server/src/app.js
- client/src/services/api.js
- client/src/App.jsx
- client/src/components/CashBook.jsx
- client/src/components/GeneralShopStatus.jsx
- client/src/general-shop-status-correction.css

### Database
No migration is required. BUILD 015 uses the existing master tables established by the foundational schema.

### Important behavior
- Branches are loaded from PostgreSQL; no branch list is hardcoded.
- Till operating capital is managed in the `tills` table.
- Branch operating capital is managed in the `branches` table.
- Employees and Service Providers are database-managed.
- Till attendant assignment is stored in `till_assignments` and previous assignments are closed, not overwritten.
- Historical Till Balance records retain the operating capital used at the time of balancing.
- Cash Book and General Shop Status now choose their branch from database-loaded branches instead of assuming branch ID 1.
- Existing Terminal Management remains separate and is not replaced.
- No Network Float Claims are introduced.
