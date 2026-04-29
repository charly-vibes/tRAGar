# embedder-transformers Specification

## Purpose
TBD - created by archiving change add-initial-capabilities. Update Purpose after archive.
## Requirements
### Requirement: Default Model
The default transformers.js embedder SHALL use `Xenova/all-MiniLM-L6-v2` (384 dimensions). It MUST expose `dim = 384` and `modelId = 'Xenova/all-MiniLM-L6-v2'` as read-only properties. An alternative model ID MAY be supplied via `embedders.transformers(modelId)`.

#### Scenario: Default model properties
- **WHEN** `embedders.transformers()` is created with no arguments
- **THEN** `embedder.dim === 384` and `embedder.modelId === 'Xenova/all-MiniLM-L6-v2'`

#### Scenario: Custom model ID
- **WHEN** `embedders.transformers('Xenova/paraphrase-multilingual-MiniLM-L12-v2')` is created
- **THEN** `embedder.modelId === 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'`

### Requirement: Lazy Loading
The embedder MUST NOT load the transformers.js pipeline during `TRAGar.create()`. The pipeline SHALL be loaded on the first call to `embed()`. Subsequent calls MUST reuse the cached pipeline instance.

#### Scenario: create() succeeds without network
- **WHEN** `TRAGar.create()` is called in a context where the CDN is unreachable
- **THEN** `create()` resolves successfully (the failure surfaces only on the first `ingest()` or `query()`)

#### Scenario: Pipeline cached after first embed
- **WHEN** `embed()` is called twice
- **THEN** the pipeline is loaded only once; the second call uses the cached instance

### Requirement: CDN and Module Loading
The embedder SHALL load transformers.js from `https://cdn.jsdelivr.net/npm/@xenova/transformers@2.x` by default. The CDN URL MUST be overridable via `opts.cdn`. If `transformers.js` is already imported in the page, the embedder SHALL reuse the existing module rather than loading a second copy.

#### Scenario: Reuse existing transformers.js
- **WHEN** the page has already imported `@xenova/transformers` before `TRAGar.create()` is called
- **THEN** the embedder does not make an additional network request for the module

#### Scenario: Custom CDN
- **WHEN** `embedders.transformers('Xenova/all-MiniLM-L6-v2', { cdn: 'https://my-cdn.example/transformers' })` is used
- **THEN** the pipeline is loaded from the custom URL, not from jsdelivr

### Requirement: Batch Processing
The embedder SHALL process texts in batches of up to 16 strings per call (configurable via `opts.batchSize`). Each call to `embed(batch)` MUST return a `Float32Array[]` of the same length as the batch. Returned vectors MUST NOT be pre-normalized; normalization is tRAGar's responsibility.

#### Scenario: Batch output matches input length
- **WHEN** `embed(['a', 'b', 'c'])` is called
- **THEN** the result array has length 3, each element a `Float32Array` of length 384

#### Scenario: Vectors not pre-normalized
- **WHEN** `embed(['hello'])` is called
- **THEN** the returned vector may have L2 norm != 1.0 (normalization is deferred to the core)

### Requirement: Input Length Handling
Strings longer than the model's `max_position_embeddings` (512 tokens for MiniLM-L6) are truncated by the transformers.js model. When truncation occurs, tRAGar MUST invoke `onWarn` with a `LongChunk` warning before calling `embed`.

#### Scenario: Long input warning
- **WHEN** a chunk with an estimated token count exceeding 512 is passed to the embedder
- **THEN** `onWarn` receives `{ kind: 'LongChunk', source, line, truncatedAt: 512 }` before the embed call

### Requirement: Embedder Error Model
The embedder MUST reject the `embed()` Promise with one of the following typed errors on failure:
- `EmbedderUnavailable` — pipeline could not load (network error, CSP block, etc.)
- `EmbedderInputTooLong` — input exceeded model context after chunker limits
- `EmbedderRuntimeError` — any other inference-time failure

#### Scenario: Network failure during load
- **WHEN** the CDN is unreachable when the embedder tries to load on first use
- **THEN** `embed()` rejects with an error whose `code === 'EmbedderUnavailable'`

#### Scenario: Runtime inference failure
- **WHEN** the transformers.js model throws an unexpected error during inference
- **THEN** `embed()` rejects with an error whose `code === 'EmbedderRuntimeError'`

#### Scenario: Partial ingest when embed fails mid-document
- **WHEN** `ingest()` has successfully committed batches 1–3 of a document and the embedder rejects on batch 4 with `EmbedderUnavailable`
- **THEN** `ingest()` rejects with `EmbedderUnavailable`; chunks already committed (batches 1–3) remain in the store with their hash-based IDs, so a subsequent re-ingest of the same document will skip the committed chunks and retry only the missing ones

