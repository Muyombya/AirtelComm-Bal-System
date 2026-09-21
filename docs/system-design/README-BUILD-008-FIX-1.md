# BUILD 008 FIX 1 — Float Handle Position

## Purpose
Correct the drag-handle placement in Till Balancing → Float Balances.

## Change
- The drag handle is now a direct left-side column of each Float Balance row.
- The terminal/provider label remains in the middle column.
- The float amount input remains on the right.
- Existing functional drag-and-drop logic is preserved.
- General Shop Status → Closing Float remains without drag handles.

## Files to replace
- `client/src/components/TillBalancing.jsx`
- `client/src/components/GeneralShopStatus.jsx`

## Not changed
- Server
- Database
- API service
- Migrations
