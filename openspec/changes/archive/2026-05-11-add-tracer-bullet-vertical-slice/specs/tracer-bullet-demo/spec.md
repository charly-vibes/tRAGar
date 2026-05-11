## ADDED Requirements
### Requirement: Shipped Tracer-Bullet Browser Example
The repository SHALL include a small browser-hosted tracer-bullet example that exercises the library end-to-end using the deterministic bootstrap slice. The example MUST prove `create() -> ingest() -> query()` works in one page load without external model downloads or persistent storage setup.

#### Scenario: Example runs with no external model dependency
- **WHEN** a developer opens the tracer-bullet example in a supported browser
- **THEN** the example loads the local tRAGar build, uses a deterministic custom embedder, and performs one successful ingest/query cycle without fetching a model from a CDN

#### Scenario: Example is bounded to bootstrap scope
- **WHEN** the tracer-bullet example is documented or tested
- **THEN** it explicitly identifies itself as a bootstrap path and does not claim to exercise OPFS persistence, transformers.js loading, or streaming query support
