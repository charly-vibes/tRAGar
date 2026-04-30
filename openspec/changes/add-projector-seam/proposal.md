# Change: Add projector seam for dimensionality reduction

## Why
`query()` returns scores but never coordinates. The Waste Land Walk needs 2D positions for every vocabulary token on every render frame, and those positions must live in a stable geometric basis so a future dimension slider can swap source dimensions without repositioning the canvas.

## What Changes
- Add new `Projector` seam interface (sixth seam, §4.4)
- Add `projectors.pca()`, `projectors.umap()`, `projectors.identity()`, and `projectors.custom()` factories
- Extend `TRAGarOptions` with optional `projector?` field
- Add `project(id)`, `projectAll()`, and `fitProjector()` instance methods to `TRAGar`

## Depends on
- `add-vector-access-export` — `fitProjector()` calls `getAllVectors()` to obtain the float32 matrix passed to `Projector.fit()`

## Impact
- Affected specs: projector (new)
- Affected code: js/tragar.ts, TRAGarOptions type, TRAGar class
