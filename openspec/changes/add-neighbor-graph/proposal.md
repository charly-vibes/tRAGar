# Change: Add pre-computed k-NN neighbor graph

## Why
In auto mode at 4 Hz, the Waste Land Walk needs the k nearest neighbors of the current token on every step. Running O(N) SIMD cosine search 4 times per second for a fixed vocabulary is correct but wasteful. The vocabulary never changes mid-session; this is a pure pre-computation opportunity.

## What Changes
- Add `NeighborGraph` interface with `neighbors(id)`, `neighborsOf(v, k?)`, `ids()`, and `toJSON()`
- Add `NeighborGraphJSON` serialization type
- Add `buildNeighborGraph(k?)` instance method to `TRAGar`
- Add performance budget entries for graph operations

## Impact
- Affected specs: neighbor-graph (new)
- Affected code: js/tragar.ts, TRAGar class
