# AirtelComm-Bal-System — BUILD 002

## Purpose

Add Terminal Master Data API support and Till ↔ Terminal assignment operations.

This is an **incremental update**. Do NOT replace the entire AirtelComm-Bal-System project with this package.

## NEW files

- `server/src/controllers/terminalController.js`
- `server/src/routes/terminalRoutes.js`
- `database/migrations/002_terminal_master_data.sql`

## UPDATED files

- `server/src/app.js`

## UNCHANGED

All other project files, including:

- `database/migrations/001_initial_till_balancing.sql`
- `database/seeds/001_initial_kitende_master_data.sql`
- PostgreSQL connection configuration
- Client application
- Existing health API

## Apply

1. Copy the files under `NEW/` into the matching folders of the existing project.
2. Replace only `server/src/app.js` with the file under `UPDATED/`.
3. Apply the migration once:

```bash
psql -U postgres -d airtelcomm_bal_system -f database/migrations/002_terminal_master_data.sql
```

4. Start the backend:

```bash
npm run dev:server
```

## API endpoints introduced

- `GET /api/terminals`
- `POST /api/terminals`
- `PUT /api/terminals/:id`
- `GET /api/tills/:tillId/terminals`
- `POST /api/tills/:tillId/terminals`
- `DELETE /api/tills/:tillId/terminals/:terminalId`

## Important

Do not create real terminal identities from workbook labels unless their actual identity has been confirmed. Build 002 deliberately does not seed terminal records.

Development rule:

BUILD → TEST → FIX → CONFIRM → PROCEED
