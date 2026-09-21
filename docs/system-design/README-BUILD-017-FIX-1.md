# BUILD 017 FIX 1 — Clear Till Balancing Entry Fields

## Change
After a Till Balance is successfully recorded, all user-entered balancing fields are cleared:
- Notes quantities
- Coin quantities
- Batch amount
- Float amounts
- Daily transaction counts

The selected Till, business date, attendant context, and operating capital remain unchanged because they are context/selection fields, not balancing entry values.

## Files modified
- client/src/components/TillBalancing.jsx

## No migration required
