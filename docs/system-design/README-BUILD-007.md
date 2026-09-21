# BUILD 007 — Compact General Shop Status

## Purpose
Refines only the General Shop Status presentation for a compact daily reconciliation / WhatsApp screenshot.

## Files to replace
- `client/src/components/GeneralShopStatus.jsx`

## CSS
Append the contents of:
- `client/src/GENERAL_SHOP_STATUS_COMPACT_CSS.txt`

to the end of `client/src/index.css`.

The CSS is intentionally additive/override-only so existing Till Balancing and Terminal Management styles are preserved.

## Not touched
- Database
- Migrations 001–006
- Server/controllers/routes
- Till Balancing logic
- Terminal Management logic
- API service

## Layout order
1. Closing Float
2. Reason
3. Till Transactions
4. Accessories Sales
5. Till Position
6. History Status

## Behavior preserved from Build 006
- Till transaction counts remain read-only and are derived from Till records.
- Accessories remains the only manually entered General Shop Status activity figure.
- Reason is required for SHORT/EXCESS.
- History Status remains visible.
- Closing Float has no Provider column.
- Existing save endpoint is used for Accessories + Reason.
