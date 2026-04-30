# public-api Specification

## Purpose
Defines the TRAGar class factory, ingestion, query, maintenance, seam factory, and warning APIs.
## Requirements
### Requirement: TRAGar Factory
The library SHALL expose a static async `TRAGar.create(opts?)` factory that returns a fully initialized `TRAGar` instance. `create()` MUST open the store and read its metadata but MUST NOT load the embedder. All five seams (chunker, embedder, store, index, reranker) SHALL have working defaults when `opts` is omitted.

#### Scenario: Zero-configuration creation
- **WHEN** `TRAGar.create()` is called with no arguments
- **THEN** a `TRAGar` instance is returned with `namespace = 'default'` and all five default seams active

#### Scenario: Custom namespace
- **WHEN** `TRAGar.create({ namespace: 'wiki' })` is called (namespace matches `/^[a-zA-Z0-9_-]{1,64}$/`)
- **THEN** the instance opens the store under the `'wiki'` namespace key

#### Scenario: Invalid namespace rejected
- **WHEN** `TRAGar.create({ namespace: '../traversal' })` is called
- **THEN** `create()` rejects with a `TRAGarError` whose `code === 'InvalidConfig'` (namespace MUST match `/^[a-zA-Z0-9_-]{1,64}$/`)

#### Scenario: Model mismatch on open — explicit embedder provided
- **WHEN** `TRAGar.create({ embedder: customEmbedder })` is called against a namespace that stores a different `modelId`
- **THEN** `create()` rejects with a `ModelMismatch` error (Case A: explicit embedder, modelId differs)

#### Scenario: Stored model auto-selection — no explicit embedder
- **WHEN** `TRAGar.create()` is called with no `opts.embedder` against a namespace whose `meta.json` records a non-default `modelId`
- **THEN** `create()` auto-loads the stored model via the transformers seam and resolves without error (Case B: no explicit embedder)

### Requirement: Ingestion Methods
The instance SHALL provide `ingest(text, meta?)` to ingest one document and `ingestMany(docs)` for batched ingestion. Both MUST return an `IngestResult` that includes the source, total chunk count, new (non-duplicate) chunk count, and elapsed milliseconds. Duplicate chunks (matched by SHA-256 hash) MUST be silently skipped and counted in `newChunkCount`. `ingestMany` returns a settled array (`IngestManyResult[]`) where each entry is `{ status: 'fulfilled', value: IngestResult }` or `{ status: 'rejected', reason: TRAGarError }` — partial failures do not prevent other documents from being ingested.

#### Scenario: Single document ingest
- **WHEN** `ingest(markdownText, { source: 'readme.md' })` is called
- **THEN** the result has `source = 'readme.md'` and `chunkCount >= 1`

#### Scenario: Duplicate suppression
- **WHEN** the same document is ingested twice
- **THEN** the second ingest returns `newChunkCount = 0` and does not append duplicate vectors to the store

#### Scenario: Batch ingest
- **WHEN** `ingestMany([{ text, meta }, ...])` is called with N documents
- **THEN** all documents are chunked and embedded, and the results array has length N

#### Scenario: ingestMany partial failure
- **WHEN** `ingestMany([docA, docB, docC])` is called and docB's embed call fails
- **THEN** the results array has length 3; entry 1 has `{ status: 'rejected', reason: TRAGarError }` while entries 0 and 2 have `{ status: 'fulfilled', value: IngestResult }` — successful documents are committed regardless of peer failures

### Requirement: Query Methods
The instance SHALL provide `query(text, opts?)` returning `Promise<Hit[]>` and `queryStream(text, opts?)` returning `AsyncIterable<Hit>`. Both MUST embed the query text, run SIMD cosine search, and (if configured) run the reranker. The default `k` is 10. An optional `filter` narrows the candidate set before scoring.

#### Scenario: Basic query
- **WHEN** `query('find relevant chunks')` is called after ingest
- **THEN** an array of up to 10 `Hit` objects is returned, each with `id`, `score`, `text`, `source`, `line`, and `meta`

#### Scenario: k parameter respected
- **WHEN** `query(text, { k: 3 })` is called
- **THEN** at most 3 hits are returned

#### Scenario: Source filter
- **WHEN** `query(text, { filter: { source: 'readme.md' } })` is called
- **THEN** all returned hits have `source = 'readme.md'`

#### Scenario: Streaming query
- **WHEN** `queryStream(text)` is iterated with `for await`
- **THEN** hits are yielded one by one in descending score order

#### Scenario: Abandoned queryStream releases C++ resources
- **WHEN** a `for await` loop over `queryStream()` is exited early via `break` or a thrown exception
- **THEN** the Embind async iterator wrapper calls the underlying `std::generator<Hit>` destructor via the iterator's `return()` method, releasing all C++ resources without a leak

### Requirement: Maintenance Methods
The instance SHALL provide:
- `delete(filter)` — soft-deletes chunks matching the filter; returns the count deleted
- `compact()` — rewrites the store, physically removing tombstoned entries
- `clear()` — removes all chunks from the namespace
- `stats()` — returns a `Stats` object with corpus metrics

#### Scenario: Delete by source
- **WHEN** `delete({ source: 'readme.md' })` is called
- **THEN** all chunks with that source are tombstoned and the count returned equals the number tombstoned

#### Scenario: Compact removes tombstones
- **WHEN** `compact()` is called after deleting entries
- **THEN** the physical row count (`rawCount`) in `stats()` equals the logical count (`count`)

#### Scenario: Stats reflects corpus size
- **WHEN** `stats()` is called after ingesting N chunks
- **THEN** `stats.count` equals N (minus any deleted chunks)

### Requirement: Instance Lifecycle
The instance SHALL expose `close()` to flush any pending writes and release the store handle. After `close()`, all further method calls MUST reject with `StoreUnavailable`. The instance SHALL expose read-only properties: `namespace`, `storeMode`, `modelId`, `dim`, `count`.

**Write serialization:** The instance queues concurrent write operations (`ingest`, `ingestMany`, `compact`, `clear`, `delete`) internally so they execute in call order. Concurrent calls do not corrupt store state.

#### Scenario: Close releases resources
- **WHEN** `instance.close()` is called
- **THEN** subsequent calls to `query()` reject with `StoreUnavailable`

#### Scenario: storeMode reflects backend
- **WHEN** the instance is created in an environment where OPFS is available
- **THEN** `instance.storeMode` equals `'opfs'`

### Requirement: Seam Factory API
The library SHALL export a namespace object (or static properties on `TRAGar`) that exposes factory functions for all five seams:
- `chunkers.markdown(opts?)`, `chunkers.fixed(tokens, overlap?)`, `chunkers.custom(fn)`
- `embedders.transformers(modelId?, opts?)`, `embedders.custom(fn, dim, modelId, opts?)` — the optional fourth argument accepts `{ silent?: boolean }` to suppress the network-call warning
- `stores.opfs(namespace?)`, `stores.indexeddb(namespace?)`, `stores.memory()`
- `indexes.flat()`
- `rerankers.none`

Each factory MUST return an object satisfying the corresponding seam interface. Custom factories MUST validate that the provided function signature matches the interface at construction time.

#### Scenario: Custom embedder injection
- **WHEN** `TRAGar.create({ embedder: TRAGar.embedders.custom(myFn, 768, 'my-model') })` is called
- **THEN** the instance uses `myFn` for all embedding calls and reports `dim = 768`

#### Scenario: Memory store for ephemeral use
- **WHEN** `TRAGar.create({ store: TRAGar.stores.memory() })` is called
- **THEN** `instance.storeMode` equals `'memory'` and no data is persisted to disk

### Requirement: Warning Callback
The library SHALL accept an `onWarn` callback in `TRAGarOptions`. When omitted, warnings MUST be forwarded to `console.warn`. The callback SHALL receive typed `Warning` objects covering: `OversizeChunk`, `LongChunk`, `QuantizationLossHigh`, `DegenerateVector`, and `StoreFallback`.

#### Scenario: OversizeChunk warning emitted
- **WHEN** a single code block exceeds the chunker's `maxTokens`
- **THEN** `onWarn` is called with `{ kind: 'OversizeChunk', source, line, tokenCount }`

#### Scenario: StoreFallback warning on OPFS unavailability
- **WHEN** OPFS is unavailable and the store falls back to IndexedDB
- **THEN** `onWarn` is called with `{ kind: 'StoreFallback', from: 'opfs', to: 'indexeddb' }`

