# BUILD 037 — Service Provider Field Correction

## Correction
In Master Data → Service Providers, the field previously labelled:

`Supervisor`

is corrected to:

`Service`

This is a real data-model correction, not only a visual label change.

## What changed

### Frontend
`client/src/components/MasterData.jsx`
- `Supervisor` label → `Service`
- provider form property `supervisorName` → `serviceName`
- provider table column `Supervisor` → `Service`
- response property `supervisor_name` → `service_name`

### Backend
`server/src/controllers/masterDataController.js`
- SELECT `service_name`
- INSERT/UPDATE `service_name`
- request property `serviceName`

### Database
`database/migrations/037_service_provider_field_correction.sql`
- Renames `service_providers.supervisor_name` to `service_name`
- Existing values are preserved during the rename.

## No other module changed
No Terminal Management, Till Balancing, General Shop Status, Cash Book,
authentication, user management, branch, or Till logic is changed.

## Apply database migration first

From:

`C:\Projects\AirtelComm-Bal-System`

run:

```bash
psql -U postgres -d airtelcomm_bal_system -f database/migrations/037_service_provider_field_correction.sql
```

Expected final line:

`COMMIT`

Do not run this against `atlas_development`.

## Then apply the two application files
Replace:
- `client/src/components/MasterData.jsx`
- `server/src/controllers/masterDataController.js`

Restart the backend/frontend as normal.

## Test
1. Manager → Master Data → Service Providers.
2. Confirm the form says `Service`, not `Supervisor`.
3. Confirm the table column says `Service`.
4. Add/edit a provider and enter a Service value.
5. Reload Master Data and confirm the Service value persists.
