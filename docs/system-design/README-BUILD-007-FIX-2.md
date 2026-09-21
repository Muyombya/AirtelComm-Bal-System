# BUILD 007 FIX 2 — Restore API exports

The previous Build 007 compact General Shop Status patch replaced `client/src/services/api.js` with an incomplete API surface. That caused the browser error:

`TillBalancing.jsx:3 Uncaught SyntaxError: The requested module '/src/services/api.js' does not provide an export named 'createTillBalance'`

## Apply

Replace ONLY:

`client/src/services/api.js`

with the included `api.js`.

Do not change the server, database, migrations, TillBalancing.jsx, or other files.

The replacement restores the existing Till Balancing exports and terminal assignment/reorder APIs, while retaining General Shop Status compatibility.
