# BUILD 008 — Float Drag-and-Drop + Closing Float Cleanup

### Replace only these files
- `client/src/components/TillBalancing.jsx`
- `client/src/components/GeneralShopStatus.jsx`

### Changes
- General Shop Status → Closing Float: removed all drag-handle symbols.
- Till Balancing → Float Balances: compact `⠿` drag handle is now functional. Drag one terminal row over another to reorder it.
- The reordered order is persisted through the existing `/tills/:tillId/terminals/order` API.
- No migration, server, API service, or CSS changes.

### Test
1. Till Balancing → select a Till with several Float Balances.
2. Drag using the small handle at the far left of a float row.
3. Drop over another row and confirm the order changes.
4. Refresh/reopen and confirm the order persists.
5. General Shop Status → Closing Float: confirm there are no drag handles.
