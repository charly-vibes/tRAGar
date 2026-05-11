# Change: Add tracer-bullet vertical slice

## Why
The repository currently has a strong v0.1 specification and several forward-looking OpenSpec proposals, but no implemented baseline slice proving that the build, WASM boundary, JS API, and end-to-end ingest/query loop all work together. We need a deliberately small tracer bullet that converts the spec work into an executable path and de-risks the first implementation steps.

## What Changes
- Add a bounded tracer-bullet implementation target centered on a no-network, in-memory end-to-end slice
- Add a shipped browser example that proves `create() -> ingest() -> query()` on top of the minimal slice
- Add a public-api requirement that the library support a deterministic custom-embedder + memory-store path suitable for bootstrap, testing, and examples
- Record explicit non-goals so this change does not absorb the 8 active seam-expansion proposals

## Impact
- Affected specs: public-api, tracer-bullet-demo (new)
- Affected code: C++ core bootstrap, Embind glue, js/tragar.ts, example app scaffold, test harness
- Related changes intentionally excluded from this slice: add-neighbor-graph, add-projector-seam, add-clusterer-seam, add-file-store, add-vector-access-export, add-intrinsic-dim-stats, add-contrastive-queries, add-vocabulary-chunker
