# BUILD 003 Refinement 2 — Corrective Patch

## Issue corrected

The Refinement 2 release accidentally replaced `client/src/services/api.js` with a version containing the terminal reorder API but omitted the existing Till Balancing API exports.

That caused the Till Balancing module import to fail and resulted in a blank browser page.

## Replace exactly one file

`client/src/services/api.js`

The corrected file restores:
- Till Balancing context API
- Create Till Balance API
- Balance History API
- Balance Details API
- Terminal reorder API
- Existing terminal/master-data APIs

## Do not change anything else

No database migration is required.
Do not rerun Migration 004.

## After replacement

Save the file and let Vite reload automatically. If necessary, refresh the browser.

Expected result: the Till Balancing page loads normally.
