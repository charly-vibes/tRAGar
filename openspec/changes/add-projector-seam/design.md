## Context
The Projector seam mirrors the existing five seams (Chunker, Embedder, Store, Index, Reranker). It is purely JS-side — PCA and UMAP run in JavaScript, not in WASM. The projected coords are float32 (not quantized) because they are used for rendering, not cosine search.

## Goals / Non-Goals
- Goals: stable 2D coordinates from stored high-dimensional vectors; composable via `projectors.*` factories; opt-in (does not affect callers that don't set `projector`)
- Non-Goals: persisting the fitted basis to the store (deferred to v0.2); projecting inside WASM

## Decisions
- Decision: `fit()` accepts `Float32Array[]` (full matrix) rather than iterating store entries — keeps the seam independent of the store internals
- Decision: `projectors.pca()` and `projectors.umap()` are lazy imports; neither is bundled into `tragar.wasm` so bundle size is unaffected for callers that don't use a projector
- Decision: `fitProjector()` is called automatically on `create()` only when a projector is configured and the namespace already has vectors; callers can manually call it after `ingest()`

## Risks / Trade-offs
- PCA basis is invalidated if new vectors are added post-fit; documented in `fitProjector()` JSDoc
- UMAP is non-deterministic; seed option recommended for reproducible layouts

## Open Questions
- Should a fitted basis be serialized to the store? (Recommendation: v0.2, skip in v0.1)
- Should projected 2D coords be quantized? (Recommendation: float32, not quantized)
