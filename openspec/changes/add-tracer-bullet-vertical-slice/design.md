## Context
`tRAGar` is currently spec-first: the OpenSpec baseline exists, and eight additional proposals explore future seams and higher-level retrieval features. The missing piece is an executable vertical slice that proves the stack can be built and exercised end-to-end before the repository takes on OPFS, transformers.js loading, streaming iterators, or more advanced seams.

## Goals / Non-Goals
- Goals:
  - Prove the build and packaging path from C++23 to WASM to TypeScript
  - Prove the public API can execute `create() -> ingest() -> query()` in a browser-hosted example
  - Keep the slice deterministic, no-network, and small enough to implement as the first code-bearing milestone
- Non-Goals:
  - No OPFS/IndexedDB persistence in the tracer bullet
  - No transformers.js loading in the tracer bullet
  - No `queryStream()` / `std::generator<Hit>` bridge in the tracer bullet
  - No neighbor graph, projector, clusterer, file store, contrastive query, intrinsic-dim stats, or vocabulary chunker work

## Decisions
- Decision: The tracer bullet is **minimal/dev-first**, not real-defaults-first
- Decision: The canonical bootstrap path uses `stores.memory()` and `embedders.custom(...)` with a deterministic embedding function so the first slice has zero network and zero persistence dependencies
- Decision: The first executable deliverable is a browser example that exercises the library, but the example is subordinate to the library surface rather than an app-first fork of the design
- Decision: `query()` is in-scope for the tracer bullet; `queryStream()` is deferred until the baseline path is working

## Risks / Trade-offs
- A minimal slice can create a false sense of completeness if not clearly bounded; mitigate by listing explicit non-goals and filing follow-on tickets for real defaults
- Choosing a deterministic custom embedder first delays validation of transformers.js integration; mitigate by making that the first follow-on slice after the bootstrap path lands
- A memory-only slice does not validate persistence semantics; mitigate by treating OPFS/IndexedDB as the next boundary once the C++/Embind/TS seam is proven

## Follow-on Work
- Slice 2: transformers.js embedder and model-loading semantics
- Slice 3: OPFS / IndexedDB store path
- Slice 4: `queryStream()` and `std::generator<Hit>` async iterator bridge
