# BUILD 002 — Terminal Management GUI

Incremental UI patch for the existing AirtelComm-Bal-System project.

## NEW
- client/src/components/TerminalManagement.jsx

## UPDATED
- client/src/App.jsx
- client/src/services/api.js
- client/src/index.css
- server/src/controllers/terminalController.js
- server/src/routes/terminalRoutes.js

## NOT TO TOUCH
- database/migrations/001_initial_till_balancing.sql
- database/migrations/002_terminal_master_data.sql
- database/seeds/001_initial_branch.sql
- database/seeds/001_initial_kitende_master_data.sql
- server/src/config/database.js
- server/src/config/environment.js
- client/package.json
- server/package.json
- PostgreSQL data
- atlas_development

## Scope
This patch adds a browser GUI for service providers, terminal registration, and Till-terminal assignment. It does not build Till Balancing, Cash Book, Shortage Counter, Network Float Claims, reports, authentication, or dashboard functionality.
