# Change: Add raw vector access and corpus export methods

## Why
The Waste Land Walk build script needs to materialize `vocab.json` from stored embeddings, and the projector's `fit()` needs the full float32 matrix. Neither is possible with the v0.1 instance surface.

## What Changes
- Add `getVector(id)`, `getAllVectors()`, and `export(format)` methods to `TRAGar`
- Add `DequantizationRequested` warning kind to the `Warning` union

## Impact
- Affected specs: public-api
- Affected code: js/tragar.ts, TRAGar class, Warning type
