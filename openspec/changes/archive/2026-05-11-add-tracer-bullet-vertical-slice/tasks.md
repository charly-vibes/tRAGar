## 1. Planning
- [x] 1.1 Finalize tracer-bullet scope: minimal/dev-first, not real-defaults-first
- [x] 1.2 Confirm explicit non-goals and boundaries against the 8 active seam-expansion changes
- [x] 1.3 Validate the proposal with `openspec validate add-tracer-bullet-vertical-slice --strict`

## 2. Vertical-slice architecture
- [x] 2.1 Define the minimal runtime path: `TRAGar.create({ store: memory(), embedder: custom(...) })`
- [x] 2.2 Define the smallest ingest pipeline that proves chunk -> embed -> store -> query
- [x] 2.3 Define the smallest browser example contract and success criteria

## 3. Implementation plan
- [x] 3.1 Sequence Slice 1 work: repo skeleton, C++ core stub, Embind bridge, TS wrapper
- [x] 3.2 Sequence Slice 2 work: in-memory store, deterministic embedder, flat query path
- [x] 3.3 Sequence Slice 3 work: browser example, smoke test, and follow-on tickets for real defaults
