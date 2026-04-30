## ADDED Requirements
### Requirement: Deterministic Bootstrap Slice
The library SHALL support a no-network bootstrap path suitable for examples, tests, and early implementation milestones by allowing callers to combine `TRAGar.stores.memory()` with `TRAGar.embedders.custom(...)` and still execute `create()`, `ingest()`, and `query()` end-to-end.

#### Scenario: Minimal deterministic ingest and query
- **WHEN** a caller creates `TRAGar.create({ store: TRAGar.stores.memory(), embedder: TRAGar.embedders.custom(fn, dim, 'deterministic-test-model') })`, ingests at least one document, and then calls `query()`
- **THEN** the library completes the full chunk -> embed -> store -> search loop without network access or persistent browser storage

#### Scenario: Bootstrap slice remains compatible with the public API
- **WHEN** the deterministic bootstrap path is used
- **THEN** the returned object still satisfies the same `TRAGar` public API contract for `namespace`, `storeMode`, `modelId`, `dim`, `count`, `ingest()`, `query()`, `stats()`, and `close()`
