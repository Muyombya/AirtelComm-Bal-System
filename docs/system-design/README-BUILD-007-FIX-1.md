BUILD 007 FIX 1 — Blank Page Correction

Purpose:
Correct the blank-page issue reported after BUILD 007.

Root cause addressed:
The compact component depended on a named saveGeneralShopStatus export from api.js. This fix removes that module dependency and performs the existing PUT /general-shop-status call locally inside the component. It also makes the rendering defensive when optional response fields are missing.

Replace ONLY:
client/src/components/GeneralShopStatus.jsx

Then append:
client/src/GENERAL_SHOP_STATUS_COMPACT_CSS.txt

to:
client/src/index.css

No database migration is required.
No server files are changed.
No Till Balancing files are changed.
No Terminal Management files are changed.
