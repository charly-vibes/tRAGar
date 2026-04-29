# Change: Add initial v0.1 capability specs

## Why
tRAGar's SPEC.md defines the complete v0.1 contract but no OpenSpec capability files exist yet. This proposal bootstraps the specs directory with all eight core capabilities so that future changes have a formal baseline to modify.

## What Changes
- **ADDED** capability: `public-api` — TRAGar factory, instance methods, type shapes, seam factories
- **ADDED** capability: `chunker-markdown` — default markdown chunker (CommonMark, heading splits, Spanish awareness)
- **ADDED** capability: `embedder-transformers` — default transformers.js embedder (lazy load, 384-dim, batch-16)
- **ADDED** capability: `store-opfs` — OPFS store with IndexedDB fallback, append semantics, schema versioning
- **ADDED** capability: `index-flat` — brute-force SIMD cosine index with top-K heap and filtering
- **ADDED** capability: `quantization` — symmetric int8 per-vector post-normalization quantization
- **ADDED** capability: `error-model` — TRAGarError hierarchy, ErrorCode enumeration, std::expected bridge
- **ADDED** capability: `browser-compat` — browser targets, required features, graceful degradation rules

## Impact
- Affected specs: none (all new)
- Affected code: none (spec-only change; implementation follows separately)
