BUILD 008 — FIX 2 — Float Balance Alignment Stabilization

Purpose:
Stabilize the Float Balances row alignment after the compact drag handle was moved to the left.

Changed:
- client/src/components/TillBalancing.jsx
  - Fixed three-column row geometry: handle / float position / amount.
  - Fixed drag-handle dimensions and alignment so every handle occupies the same left-side position.
  - Stabilized the float position text column with left alignment so provider and terminal names begin from the same horizontal point.
  - Kept the amount input column fixed on the right.
  - Drag-and-drop functionality remains unchanged.

Not touched:
- GeneralShopStatus.jsx
- api.js
- Server
- Database
- Migrations
