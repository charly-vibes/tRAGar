# Change: Add contrastive and boundary query options

## Why
The Waste Land Walk places certain words between clusters by editorial judgment. Finding these automatically requires expressing "find tokens geometrically near the boundary between cluster A and cluster B" — not expressible with the current `query()` API.

## What Changes
- Extend `QueryOptions` with `toward`, `awayFrom`, and `boundaryOf` fields
- Add `TermNotFound` error code
- All three options modify the query vector before the SIMD search pass — no change to the index or score computation path

## Impact
- Affected specs: public-api
- Affected code: js/tragar.ts, QueryOptions type, ErrorCode type, query/queryStream implementations
