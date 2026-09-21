# BUILD 005 — General Shop Status

This is an incremental release following Till Balancing. It does **not** replace the project.

## Purpose

Build the branch-level General Shop Status block from the Kitende balancing workflow:

- Branch operating capital from active Tills
- Total cash from the latest Till balance recorded for the selected business date
- Total float from the latest Till balance recorded for the selected business date
- Branch actual capital and branch balancing status
- Closing float positions aggregated by terminal/position
- Till-by-Till position summary
- Daily transaction counts for the General Shop Status categories

Transaction counts are stored separately because the individual transaction modules do not exist yet. When those modules are built, their transaction counts can replace the manual entry source.

## Important behavior

If not all active Tills have a balance for the selected business date, the branch result is shown as **BALANCING INCOMPLETE** instead of incorrectly declaring a branch shortage/excess.

## Files to ADD

- `database/migrations/005_general_shop_status.sql`
- `server/src/controllers/generalShopStatusController.js`
- `server/src/routes/generalShopStatusRoutes.js`
- `client/src/components/GeneralShopStatus.jsx`

## Files to MODIFY

- `server/src/app.js`
- `client/src/App.jsx`
- `client/src/services/api.js`
- `client/src/index.css`

## Files NOT to replace

- Existing Till Balancing component
- Existing Terminal Management component/controller/routes
- `server/src/config/environment.js`
- `server/src/config/database.js`
- Existing migrations 001–004
- Existing seed data
- `.env`

## Database

Run only:

`psql -U postgres -d airtelcomm_bal_system -f database/migrations/005_general_shop_status.sql`

Do not rerun earlier migrations.

## Navigation

A new **General Shop Status** navigation item is added beside the existing Till Balancing and Terminal Management modules.
