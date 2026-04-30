# Change: Add clusterer seam for semantic grouping

## Why
After projection to 2D, the Waste Land Walk needs cluster labels for coloring dots, assigning tiers, and generating the vocabulary's semantic region map. tRAGar has no clustering seam in v0.1.

## What Changes
- Add new `Clusterer` seam interface (seventh seam, §4.5)
- Add `clusterers.kmeans()`, `clusterers.spectral()`, `clusterers.manual()`, and `clusterers.hybrid()` factories
- Add `ClusterMap` and `ClusterAssignment` types
- Extend `TRAGarOptions` with optional `clusterer?` field
- Add `cluster()` instance method to `TRAGar`

## Depends on
- `add-neighbor-graph` — the `NeighborGraph` type and `buildNeighborGraph()` method must exist before `Clusterer.fit()` can be implemented

## Impact
- Affected specs: clusterer (new)
- Affected code: js/tragar.ts, TRAGarOptions type, TRAGar class
