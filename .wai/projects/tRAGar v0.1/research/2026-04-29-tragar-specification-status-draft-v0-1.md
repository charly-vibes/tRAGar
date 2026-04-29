# tRAGar — Specification

**Status:** Draft · v0.1.0-spec · April 29, 2026
**Author:** charly-vibes
**License (intended):** MIT
**Target standards:** C++23 (mandatory), C++26 (opt-in features)
**Companion essay:** *Resonant Coding II — Tragar el corpus* (forthcoming)

---

## 0. Document conventions

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are used in the RFC 2119 sense.

Type and interface shapes appear inline as schema-level declarations, not implementation. They are part of the contract, not source code.

Where a Spanish term carries a design intent, both languages are given (e.g. "swallow / *tragar*").

This spec is the authority for v0.1 behavior. Implementation details that this spec does not pin down are explicitly the implementer's choice and may change between patch versions.

---

## 1. Summary

**tRAGar** is a client-side Retrieval-Augmented Generation library for the browser. It compiles a C++23 core to WebAssembly and exposes one small, opinionated JavaScript/TypeScript surface that does end-to-end RAG: chunk → embed → store → search → (optionally) rerank.

The contract is *one happy path, escape hatches everywhere*. Three lines of code work with zero configuration. Every internal stage — chunker, embedder, store, index, reranker — is a named, swappable seam that defaults to a sensible production choice.

The name combines *tragar* (Spanish: "to swallow") and **RAG**. The corpus gets swallowed; the answer is retrieved.

---

## 2. Goals and non-goals

### 2.1 Goals

1. **Ship as one `.wasm` + one `.js`** that can be served from any static host (GitHub Pages first-class). No npm install required to use, no build step required, no CDN dependency at runtime after first load.
2. **Three-line happy path.** `create() → ingest() → query()` with no configuration must work for any sane markdown corpus.
3. **Five composable seams.** Chunker, embedder, store, index, reranker. Each is addressable, each has a default, each is replaceable with a single property in the config object.
4. **Local-first.** Vectors and chunks live in the browser. No data crosses any network boundary the user did not opt into.
5. **Spanish-aware where it counts.** The default markdown chunker handles Spanish prose properly: voseo, sinalefa, accented monosyllables, UTF-8 throughout.
6. **Modern C++ as a quality forcing function.** The C++23 surface (`std::mdspan`, `std::simd`, `std::generator`, `std::expected`, ranges) is used where it earns its keep, not for novelty.
7. **Demo-able in a weekend.** v0.1 is scoped to be implementable by one person in one focused weekend.

### 2.2 Non-goals

1. **Not a vector database.** No multi-tenant, no clustering, no replication, no SQL surface. Single-process, single-namespace per instance.
2. **Not an embedder.** v0.1 delegates embedding to `transformers.js`. tRAGar does not implement transformer inference.
3. **Not an LLM client.** tRAGar returns ranked text chunks. The user is responsible for sending those chunks to whatever generator they prefer (or for not sending them at all — pure semantic search is a valid use case).
4. **Not a UI.** No React components, no widgets. tRAGar is a library; demos are separate.
5. **Not for >1M chunks.** The brute-force flat index targets corpora up to ~50K chunks. Larger corpora are explicitly v0.2's HNSW concern.
6. **Not Node-first.** v0.1 is browser-first. Node compatibility is best-effort and not tested.

---

## 3. Glossary

- **Corpus** — the entire collection of source material associated with one tRAGar instance. A namespace.
- **Document** — one source unit, identified by a `source` string (typically a path or URL). One document produces zero or more chunks.
- **Chunk** — an atomic unit of text that the embedder converts to a single vector. Has stable identity within a corpus.
- **Vector** — a float32 array of dimension `D` produced by the embedder. Stored as int8 after quantization.
- **Embedder** — a function from text to vector. v0.1 default delegates to `transformers.js`.
- **Store** — persistent storage for vectors, chunk text, and metadata.
- **Index** — the structure searched at query time. v0.1 default is brute-force SIMD cosine.
- **Reranker** — an optional second pass over top-K results that produces a reordered list. v0.1 default is `none`.
- **Seam** — one of the five replaceable interfaces (chunker, embedder, store, index, reranker).
- **Hit** — a query result: chunk text, score, source, plus optional position metadata.
- **Namespace** — the string key under which a corpus is stored, defaults to `"default"`.
- **Schema version** — integer pinned in stored metadata; bumped when on-disk format changes.

---

## 4. Architecture

### 4.1 Layering

tRAGar has four layers, top to bottom:

1. **JS API surface** — the public interface, the only thing user code touches. TypeScript-typed, async-everywhere.
2. **Embind glue** — C++ → JS marshaling. Marshals `std::generator<Hit>` to async iterators, `std::expected<T,E>` to Promise resolve/reject, `std::span` to typed arrays.
3. **C++23 core** — chunking, quantization, indexing, search. Pure logic, no I/O, no JS knowledge.
4. **Platform bindings** — OPFS / IndexedDB / Worker shims, exposed back into the C++ core via callbacks where needed.

The user touches layer 1 only. Layer 2 is generated code (Embind). Layer 3 is the bulk of the implementation. Layer 4 is small, deliberate, and tested in isolation.

### 4.2 Dataflow

**Ingestion (`ingest(text, meta)`):**

1. JS calls `ingest()` with a UTF-8 string and a metadata object.
2. C++ chunker receives the string; emits a stream of `Chunk{ id, text, source, line, hash }`.
3. For each batch of chunks (default batch size: 16), JS calls the embedder backend.
4. The embedder returns float32 vectors of dimension `D`.
5. C++ unit-normalizes each vector, then quantizes to int8 with a per-vector float32 scale.
6. C++ appends the int8 vector + scale + chunk metadata to the store.
7. The flat index keeps a hot-loaded `std::mdspan<int8_t, 2>` view over the vector matrix.

**Query (`query(text, opts)`):**

1. JS calls `query()` with a string and `{ k, filter? }`.
2. C++ runs the same chunker on the query string; if multiple chunks emerge, only the first is used (queries are assumed short).
3. JS calls the embedder backend on the query text → float32 vector.
4. C++ unit-normalizes and quantizes the query vector.
5. C++ index runs SIMD cosine against the matrix, maintains a top-K min-heap.
6. Results stream back as a `std::generator<Hit>`, exposed to JS as an async iterator.
7. If a reranker is configured, hits flow through it before the iterator yields.

### 4.3 The five seams

Each seam is a contract describing a small set of methods. The C++ side expresses contracts as concepts; the JS side expresses them as TypeScript interfaces. Both must agree.

#### Chunker

A chunker is a stateless function from `(text, meta)` to a stream of chunks.

```
interface Chunker {
  chunk(text: string, meta: DocumentMeta): AsyncIterable<Chunk>;
}
```

Default: `chunkers.markdown({ targetTokens: 400, maxTokens: 800, minTokens: 50, overlapTokens: 50 })`. See §5.

#### Embedder

An embedder is an async function from a batch of strings to a batch of float32 vectors.

```
interface Embedder {
  readonly dim: number;
  readonly modelId: string;
  embed(batch: string[]): Promise<Float32Array[]>;
}
```

Default: `embedders.transformers('Xenova/all-MiniLM-L6-v2')`. See §6.

#### Store

A store is the persistence layer. It owns the on-disk format.

```
interface Store {
  open(namespace: string): Promise<void>;
  appendVector(id: ChunkId, v: Int8Array, scale: number): Promise<void>;
  appendChunk(c: Chunk): Promise<void>;
  loadAllVectors(): Promise<{ matrix: Int8Array, scales: Float32Array, count: number }>;
  loadChunk(id: ChunkId): Promise<Chunk>;
  meta(): Promise<StoreMeta>;
  setMeta(m: StoreMeta): Promise<void>;
  compact(): Promise<void>;
  clear(): Promise<void>;
}
```

Default: `stores.opfs('default')` with automatic IndexedDB fallback if OPFS is unavailable. See §7.

#### Index

An index searches the vector matrix.

```
interface Index {
  build(matrix: Int8Array, scales: Float32Array, dim: number): Promise<void>;
  add(v: Int8Array, scale: number, id: ChunkId): Promise<void>;
  search(query: Int8Array, queryScale: number, k: number, filter?: Filter): AsyncIterable<RawHit>;
}
```

Default: `indexes.flat()`. See §8.

#### Reranker

A reranker reorders top-K hits.

```
interface Reranker {
  rerank(query: string, hits: Hit[]): Promise<Hit[]>;
}
```

Default: `rerankers.none` (identity). See §9.

---

## 5. Default chunker — `markdown`

### 5.1 Behavior

The default chunker:

1. **Parses input as CommonMark** via MD4C. Non-markdown text is treated as a single "body" block.
2. **Splits at heading boundaries** (H1, H2, H3 by default). H4–H6 do not start a new chunk; they are kept as inline content of the parent.
3. **Targets ~400 tokens per chunk**, where a token is approximated by the embedder's tokenizer if available, else by a `char_count / 4` heuristic.
4. **Hard-caps at 800 tokens.** A long paragraph or code block that would exceed 800 tokens is split with a 50-token overlap.
5. **Soft-floor at 50 tokens.** A heading-section shorter than 50 tokens is merged with its sibling (preferring the next sibling).
6. **Treats fenced code blocks atomically.** A code block is never split. If a single code block exceeds 800 tokens, it becomes its own oversized chunk and an `OversizeChunk` warning is emitted.
7. **Treats list items atomically when possible.** A bullet or numbered list of 30 short items is one chunk; a list of long items is split per-item.
8. **Preserves line numbers** of the first character of each chunk in the source string.
9. **Computes a SHA-256 hash** of `(source + chunk_index + chunk_text)` as the chunk's stable identity.

### 5.2 Spanish awareness

The chunker is UTF-8 throughout. Spanish-specific behavior:

- Word boundaries respect Unicode's `\w` extended to Spanish letters including `ñ Ñ ü Ü á é í ó ú Á É Í Ó Ú`.
- Sentence boundaries handle Spanish punctuation: `¿ ¡ ; :` are treated as soft sentence-internal markers, not splits.
- The token approximation accounts for the slightly higher character count of Spanish vs English (`char_count / 3.8` instead of `/4` when the corpus is detected as Spanish-majority).

### 5.3 Configuration

```
{
  targetTokens?: number;     // default 400
  maxTokens?: number;        // default 800
  minTokens?: number;        // default 50
  overlapTokens?: number;    // default 50
  splitAtHeadings?: 1|2|3|4|5|6;  // default 3
  preserveCodeBlocks?: boolean;   // default true
  language?: 'auto'|'es'|'en';    // default 'auto'
}
```

### 5.4 Output

Each chunk has:

```
type Chunk = {
  id: string;            // sha256 hex (stable across re-ingest of same source)
  text: string;          // the chunk content, trimmed
  source: string;        // from DocumentMeta
  line: number;          // 1-indexed line of first character in source
  index: number;         // 0-indexed position within the document
  tokenCount: number;    // approximate
  meta: Record<string, unknown>;  // user-provided pass-through
};
```

---

## 6. Default embedder — `transformers`

### 6.1 Backend

The default embedder delegates to `transformers.js` (HuggingFace). v0.1 uses **`Xenova/all-MiniLM-L6-v2`** (384 dimensions, ~23 MB cached after first load) as the default model.

Rationale for this choice over `gte-small` or `bge-small`:

- `all-MiniLM-L6-v2` is the most battle-tested model in the transformers.js ecosystem.
- 384 dimensions is the sweet spot for browser memory budgets at 10K-50K chunks (≤50 MB int8).
- ONNX weights are pre-quantized and load quickly.
- Multilingual performance is acceptable for Spanish prose despite the model being English-trained; v0.2 will offer `paraphrase-multilingual-MiniLM-L12-v2` as a Spanish-first alternative.

### 6.2 Loading

The embedder is loaded **lazily on first `ingest()` or `query()`**, not on `create()`. This keeps `create()` synchronous-feeling and lets `create()` succeed in environments where the transformers.js CDN is temporarily unreachable (the failure surfaces only when the user actually needs to embed).

The embedder loader:

1. Checks if `transformers.js` is already imported. If so, uses the existing module.
2. Otherwise, dynamically imports `https://cdn.jsdelivr.net/npm/@xenova/transformers@2.x` (the URL is configurable via `embedders.transformers({ cdn: '...' })`).
3. Calls `pipeline('feature-extraction', modelId, { quantized: true })`.
4. Caches the pipeline on the embedder instance.

Models are persisted by transformers.js to the browser's Cache Storage automatically; tRAGar does not manage this.

### 6.3 Batch shape

Default batch size: **16 strings per call**. The embedder accepts strings up to the model's `max_position_embeddings` (512 for MiniLM-L6); longer strings are truncated by the model with a `LongChunk` warning emitted by tRAGar.

### 6.4 Output contract

The embedder returns a `Float32Array[]` of length `batch.length`, each of length `dim` (384 for the default model). Vectors **MUST NOT** be pre-normalized by the embedder; tRAGar normalizes them itself.

### 6.5 Error model

The embedder must reject the Promise with one of:

- `EmbedderUnavailable` — backend could not load (network, CSP, etc.)
- `EmbedderInputTooLong` — input exceeded model context after the chunker's max-tokens
- `EmbedderRuntimeError` — anything else

---

## 7. Default store — `opfs`

### 7.1 Filesystem layout

Under the OPFS root, all tRAGar data lives at `tragar/{namespace}/`. For the default namespace `"default"`, that means `tragar/default/`.

Files within a namespace directory:

| File | Purpose | Format |
|---|---|---|
| `meta.json` | Schema version, model id, dim, count, timestamps | JSON |
| `vectors.bin` | Quantized vector matrix | packed `int8`, row-major, `[N × dim]` |
| `scales.bin` | Per-vector quantization scales | packed `float32`, length `N` |
| `chunks.jsonl` | Chunk text and metadata | one JSON object per line |
| `lookup.bin` | Byte offsets into `chunks.jsonl` | packed `uint64`, length `N` |
| `tombstones.bin` | Soft-deleted ids | packed `uint32`, sparse |

### 7.2 Append semantics

`vectors.bin`, `scales.bin`, `chunks.jsonl`, and `lookup.bin` are append-only during normal operation. Deletion sets a tombstone bit but does not rewrite the matrix. `compact()` rewrites all four files, dropping tombstoned entries.

### 7.3 `meta.json` shape

```
{
  "schemaVersion": 1,
  "modelId": "Xenova/all-MiniLM-L6-v2",
  "dim": 384,
  "count": 1234,                  // logical count after tombstones
  "rawCount": 1280,               // physical rows, including tombstones
  "createdAt": "2026-04-29T14:00:00Z",
  "updatedAt": "2026-04-29T14:32:11Z",
  "language": "es",
  "chunkerConfig": { ... },        // exact config used, for reproducibility
  "embedderConfig": { ... }
}
```

### 7.4 Schema versioning

`schemaVersion` is an integer. v0.1 ships schema version `1`. Any future version bump requires either:

- A documented migration path that runs on `open()` if an older version is detected, or
- An explicit user-driven `migrate()` call.

A namespace whose schema version exceeds the library's supported version causes `open()` to reject with `SchemaTooNew`.

### 7.5 IndexedDB fallback

If `navigator.storage.getDirectory()` throws (Safari < 16, embedded WebView, locked-down contexts), the store automatically falls back to IndexedDB with the same logical structure mapped to two object stores:

- `tragar.{namespace}.blobs` — keys are filenames, values are ArrayBuffers
- `tragar.{namespace}.chunks` — keys are chunk ids, values are chunk records

The fallback is feature-complete but slower for large corpora. The fallback choice is logged on `open()` and exposed via `instance.storeMode`.

### 7.6 Concurrency and atomicity

The store assumes **single-writer per namespace**. Concurrent writes from multiple tabs to the same namespace are not protected by the store. Users who need multi-tab safety should:

- Use distinct namespaces per tab, or
- Coordinate via `BroadcastChannel` at a higher level (out of scope for v0.1).

Each individual write is atomic at the file level (OPFS guarantees this for `createSyncAccessHandle().write()` in a worker context, or for the equivalent atomic-rename pattern in the main thread).

---

## 8. Default index — `flat`

### 8.1 Algorithm

Brute-force cosine similarity over the int8-quantized matrix using SIMD.

For a query vector `q` (already normalized and quantized to `q_int8` with scale `q_s`) and a candidate vector `d_int8` with scale `d_s`:

```
similarity ≈ dot(q_int8, d_int8) * q_s * d_s
```

Because vectors are unit-normalized before quantization, this approximates true cosine to within the quantization error bound (see §10).

### 8.2 SIMD strategy

The dot product is implemented with `std::simd<int8_t>` using `std::experimental::reduce` or its equivalent. WASM SIMD128 supports 16-wide int8 operations natively in 2026; the inner loop processes 16 dimensions per iteration for `dim=384`, totaling 24 SIMD iterations per candidate.

The per-query cost for a 10K-vector corpus at dim=384:

- 10K × 24 SIMD iterations = 240K iterations
- Plus 10K × float32 multiplies for the scale denormalization
- Plus top-K min-heap maintenance (O(N log K) for K=10, negligible)

Target: **<10 ms wall-clock** on a 2020-era laptop (Apple M1 or equivalent x86) for `dim=384, N=10000, K=10`.

### 8.3 Top-K

A min-heap of size `K` (default 10) holds the current best hits. New candidates are compared against the heap root and replace it if better. After all candidates are scored, the heap is drained in descending order.

### 8.4 Filtering

`query(text, { filter })` accepts an optional filter predicate evaluated **before** scoring. The filter shape is intentionally minimal in v0.1:

```
type Filter = {
  source?: string | string[] | RegExp;   // match Chunk.source
  meta?: Record<string, unknown>;         // exact-match on Chunk.meta keys
};
```

Filter evaluation runs in C++ over the chunk metadata sidecar; matching chunks proceed to scoring, non-matching are skipped.

### 8.5 Configuration

`flat()` takes no configuration in v0.1. The seam exists so it can be replaced with `hnsw()` in v0.2.

---

## 9. Default reranker — `none`

The default reranker is the identity function. Hits returned by the index are passed through unchanged.

The seam exists so v0.3's cross-encoder reranker can be added without an API break.

---

## 10. Quantization

### 10.1 Scheme

**Symmetric int8, per-vector, post-normalization.**

Procedure for embedding a chunk's vector `v` (Float32Array, length `D`):

1. Compute L2 norm: `‖v‖ = sqrt(Σ vᵢ²)`.
2. Normalize: `v' = v / ‖v‖`. Now `‖v'‖ = 1`.
3. Find max absolute value: `m = max(|v'ᵢ|)`.
4. Compute scale: `s = m / 127.0`.
5. Quantize: `q[i] = round(v'[i] / s)`, clamped to `[-127, 127]`.
6. Store `q` (int8, length D) and `s` (float32).

Dequantization (only for diagnostics; never done at query time):

```
v_recovered[i] ≈ q[i] * s
```

### 10.2 Cosine recovery

For two quantized vectors `(q_a, s_a)` and `(q_b, s_b)`:

```
cosine(a, b) ≈ dot(q_a, q_b) * s_a * s_b
```

This holds because `a` and `b` are unit-normalized, so cosine = dot product, and the int8 dot product times the scales is an unbiased estimator of the true float32 dot product.

### 10.3 Accuracy expectations

For `D = 384` and typical sentence-embedding distributions:

- Mean absolute cosine error: ≤ 0.005
- Top-10 ranking agreement with float32: ≥ 95% on standard benchmarks
- Pathological case (vectors with one very large component): ≤ 1% of corpora; flagged as `QuantizationLossHigh` if detected during ingest

These bounds are **observed**, not contractual. Users with stricter requirements set `precision: 'f32'` (v0.2).

### 10.4 Storage savings

For `D = 384`, `N = 10000`:

- Float32: 10000 × 384 × 4 bytes = **15.4 MB**
- Int8 (with scales): 10000 × (384 + 4) bytes = **3.9 MB**

About 4× reduction. This is the difference between "fits comfortably in OPFS" and "user notices the storage usage."

---

## 11. Public API

### 11.1 The `TRAGar` factory

```
class TRAGar {
  static async create(opts?: TRAGarOptions): Promise<TRAGar>;
}

type TRAGarOptions = {
  namespace?: string;       // default 'default'
  chunker?: Chunker;        // default chunkers.markdown()
  embedder?: Embedder;      // default embedders.transformers(...)
  store?: Store;            // default stores.opfs(namespace)
  index?: Index;            // default indexes.flat()
  reranker?: Reranker;      // default rerankers.none
  onWarn?: (w: Warning) => void;  // default: console.warn
};
```

`create()` is async because it opens the store and reads metadata, but it does **not** load the embedder. The embedder loads on first use.

If the namespace already has data on disk and the stored `modelId` does not match the current embedder's `modelId`, `create()` rejects with `ModelMismatch` unless `opts.embedder` is omitted (in which case tRAGar uses the stored model id and loads the matching transformers.js model automatically).

### 11.2 Instance methods

```
class TRAGar {
  readonly namespace: string;
  readonly storeMode: 'opfs' | 'indexeddb' | 'memory';
  readonly modelId: string;
  readonly dim: number;
  readonly count: number;   // current chunk count

  // Ingestion
  ingest(text: string, meta?: DocumentMeta): Promise<IngestResult>;
  ingestMany(docs: { text: string; meta?: DocumentMeta }[]): Promise<IngestResult>;

  // Query
  query(text: string, opts?: QueryOptions): Promise<Hit[]>;
  queryStream(text: string, opts?: QueryOptions): AsyncIterable<Hit>;

  // Maintenance
  delete(filter: Filter): Promise<number>;   // returns count deleted
  compact(): Promise<void>;
  clear(): Promise<void>;
  stats(): Promise<Stats>;

  // Lifecycle
  close(): Promise<void>;
}
```

### 11.3 Type shapes

```
type DocumentMeta = {
  source: string;                          // required: a path, URL, or stable id
  title?: string;
  language?: 'es' | 'en' | 'auto';
  meta?: Record<string, unknown>;          // arbitrary user payload
};

type IngestResult = {
  source: string;
  chunkCount: number;
  newChunkCount: number;                   // excludes duplicates by hash
  durationMs: number;
};

type QueryOptions = {
  k?: number;                              // default 10
  filter?: Filter;
  rerank?: boolean;                        // default true if reranker is configured
};

type Hit = {
  id: string;
  score: number;                           // cosine similarity, [-1, 1]
  text: string;
  source: string;
  line: number;
  meta: Record<string, unknown>;
};

type Stats = {
  count: number;
  rawCount: number;                        // pre-tombstone
  storeBytes: number;
  modelId: string;
  dim: number;
  language: string;
  schemaVersion: number;
};

type Warning =
  | { kind: 'OversizeChunk'; source: string; line: number; tokenCount: number }
  | { kind: 'LongChunk'; source: string; line: number; truncatedAt: number }
  | { kind: 'QuantizationLossHigh'; source: string; line: number; loss: number }
  | { kind: 'StoreFallback'; from: 'opfs'; to: 'indexeddb' };
```

### 11.4 The seam factories

```
const TRAGar = {
  create,
  chunkers: {
    markdown(opts?: MarkdownChunkerOpts): Chunker;
    fixed(tokens: number, overlap?: number): Chunker;
    custom(fn: (text: string, meta: DocumentMeta) => AsyncIterable<Chunk>): Chunker;
  },
  embedders: {
    transformers(modelId?: string, opts?: TransformersOpts): Embedder;
    custom(fn: (batch: string[]) => Promise<Float32Array[]>, dim: number, modelId: string): Embedder;
  },
  stores: {
    opfs(namespace?: string): Store;
    indexeddb(namespace?: string): Store;
    memory(): Store;
  },
  indexes: {
    flat(): Index;
  },
  rerankers: {
    none: Reranker;
  },
};
```

In v0.1, the only seams that matter for typical use are `embedders.transformers(otherModelId)` and `stores.memory()` (for ephemeral use cases). The others are present so the API is shape-stable from day one.

---

## 12. Error model

All errors thrown across the JS boundary are subclasses of `TRAGarError`:

```
class TRAGarError extends Error {
  readonly code: ErrorCode;
  readonly cause?: unknown;
}

type ErrorCode =
  | 'StoreUnavailable'
  | 'StoreCorrupt'
  | 'SchemaTooNew'
  | 'SchemaTooOld'
  | 'ModelMismatch'
  | 'EmbedderUnavailable'
  | 'EmbedderInputTooLong'
  | 'EmbedderRuntimeError'
  | 'QuotaExceeded'
  | 'NamespaceLocked'
  | 'InvalidConfig'
  | 'Internal';
```

The C++ core uses `std::expected<T, TRAGarError>` for every fallible operation. The Embind layer translates `unexpected(err)` to a Promise rejection with the matching JS error.

`TRAGarError.cause` carries the underlying error when wrapping a platform error (DOMException, etc.).

---

## 13. Concurrency model

### 13.1 Threads in v0.1

- **Main thread:** all JS API surface, all Embind calls, the embedder (transformers.js runs on the main thread or a Worker depending on its own configuration; tRAGar does not control this).
- **C++ core:** runs on the calling thread. WASM threads are not used in v0.1.

### 13.2 Why no Worker in v0.1

A Worker would require:

- COOP/COEP headers (GitHub Pages does not set these without a custom `_headers` file or an intermediate host like Cloudflare).
- A separate worker bundle.
- Marshalling vectors across the Worker boundary on every query.

The query path is fast enough on the main thread (<10 ms target) that a Worker would not improve perceived latency for v0.1. v0.3 may move the index search to a Worker if measurements justify it.

### 13.3 Async surface

Every public method returns a Promise. Internally, "synchronous" C++ paths still return Promises so the API does not break when work moves into a Worker later.

---

## 14. Performance budgets

These are explicit targets for v0.1. Failing any of them is a release blocker.

| Operation | Corpus | Target | Notes |
|---|---|---|---|
| `create()` | empty namespace | < 50 ms | OPFS open + meta.json read |
| `create()` | 10K-chunk namespace | < 200 ms | + matrix mmap into mdspan |
| `ingest()` per chunk | warm embedder | < 30 ms | dominated by transformers.js |
| `query()` end-to-end | 10K chunks, dim=384, k=10 | < 50 ms | embedder + index + IO |
| `query()` index portion only | 10K chunks, dim=384, k=10 | < 10 ms | SIMD cosine + heap |
| WASM bundle size | gzipped | < 400 KB | excludes transformers.js |
| First `query()` cold | embedder not loaded | < 5 s | dominated by model download |
| Storage per chunk | dim=384 | < 1 KB amortized | int8 vector + chunk text + metadata |

Benchmarks live in `bench/` and run in CI. Regressions of more than 20% on any budget block merges.

---

## 15. Browser compatibility

### 15.1 Supported

- **Chromium ≥ 122** — first-class
- **Firefox ≥ 124** — first-class (OPFS available; SIMD enabled)
- **Safari ≥ 17.4** — first-class (OPFS shipped 17, WASM SIMD shipped 16.4)
- **Mobile Safari ≥ 17.4** — supported with IndexedDB fallback if OPFS quirks emerge

### 15.2 Required features

- `WebAssembly` with SIMD support (universally available in target browsers)
- `BigInt` (universally available)
- `Promise.allSettled` (universally available)
- One of: `navigator.storage.getDirectory()` (OPFS) **or** `indexedDB`
- `crypto.subtle.digest` for SHA-256 chunk hashing

### 15.3 Graceful degradation

Missing OPFS → IndexedDB store, with a `StoreFallback` warning.
Missing WASM SIMD → tRAGar refuses to load with `Internal: SIMD required`. (No scalar fallback in v0.1; the perf budget is unattainable without SIMD and a slow library is worse than a missing one.)

---

## 16. Build and distribution

### 16.1 Toolchain

- **Compiler:** Emscripten 3.1.x (sysroot includes libc++ with `std::generator`, `std::expected`, `std::print`, partial `std::simd`)
- **C++ standard:** `-std=c++23`
- **Optimization:** `-O3 -msimd128 -flto`
- **Hardening (debug builds):** `-D_LIBCPP_HARDENING_MODE=_LIBCPP_HARDENING_MODE_EXTENSIVE`, ASan + UBSan
- **Modules:** opt-in for v0.1 (Emscripten module support is still maturing); fallback is conventional headers

### 16.2 Build outputs

```
dist/
  tragar.js         # ES module, ~30 KB, the JS surface and Embind glue
  tragar.wasm       # ~350 KB gzipped
  tragar.d.ts       # TypeScript declarations
```

A separate `dist/tragar.bundle.js` includes both the JS and an inlined base64 `.wasm` for one-file embedding.

### 16.3 CDN and pinning

`https://charly-vibes.github.io/tragar/v0.1.0/tragar.js` is the canonical pinned URL. The tag `latest` (`/tragar/latest/`) tracks the most recent release.

### 16.4 Source layout

```
tragar/
├── SPEC.md                     # this document
├── README.md
├── CMakeLists.txt
├── CMakePresets.json
├── vcpkg.json                  # for native testing only
├── src/
│   ├── core/                   # C++23, no platform deps
│   │   ├── chunker_markdown.cpp
│   │   ├── quantize.cpp
│   │   ├── index_flat.cpp
│   │   └── ...
│   ├── platform/               # OPFS, IndexedDB shims
│   └── bind/                   # Embind glue
├── js/
│   ├── tragar.ts               # public API
│   ├── seams/                  # JS-side seam implementations
│   └── types.ts
├── bench/                      # native + browser benches
├── test/
│   ├── unit/                   # native gtest/Catch2
│   ├── golden/                 # corpus-based agreement tests
│   └── browser/                # Playwright smoke tests
└── examples/
    ├── microdancing-search/    # the dogfood demo
    └── three-line/
```

### 16.5 CI matrix

GitHub Actions runs on every PR:

- Native build: GCC 14, Clang 19 — both with C++23, both with sanitizers
- WASM build: Emscripten 3.1.x
- Browser tests: Playwright on Chromium, Firefox, WebKit
- Bench regression check
- `clang-tidy` with `bugprone-*`, `cppcoreguidelines-*`, `modernize-*`
- `clang-format` enforcement

---

## 17. Testing strategy

### 17.1 Unit tests

Native C++ tests using **Catch2 v3** for the C++ core. Coverage targets:

- Chunker: golden corpus of 50 markdown documents (Spanish + English), expected chunk counts and boundaries pinned in test data.
- Quantizer: round-trip accuracy bounds, edge cases (zero vector, single-component vector, NaN).
- Index: top-K agreement against a float32 reference implementation on a 1K synthetic corpus.

### 17.2 Browser smoke tests

Playwright tests against the built `dist/`:

- Three-line happy path completes in < 10 seconds (including model download on first run).
- `query()` returns non-empty for a known-good corpus.
- Persistence: ingest, close, recreate, query — same hits.
- Fallback: with OPFS disabled via Playwright flag, IndexedDB path works.

### 17.3 Golden retrieval test

A 200-document Spanish-language corpus (public domain: selected works from Project Gutenberg en español) with 50 hand-written queries and expected top-1 sources. Regression in top-1 accuracy below 80% blocks releases.

### 17.4 Determinism

Given identical input and identical configuration, two ingests produce byte-identical store files. The chunker, quantizer, and index are all deterministic. The embedder's determinism is delegated to transformers.js and is best-effort.

---

## 18. Security and privacy

### 18.1 Data locality

By default, no data leaves the browser except:

- Initial download of the embedder model from the configured CDN (the user opts into this by using the `transformers` embedder).
- Initial download of `tragar.js` and `tragar.wasm` from wherever the page hosts them.

No telemetry, no error reporting, no analytics. This is enforced by audit, not by policy.

### 18.2 Custom embedder warning

If the user configures `embedders.custom(fn, ...)` with a function that makes network calls (e.g. an OpenAI embeddings client), a one-time `console.warn` is emitted on first use noting that text is leaving the browser. The user can suppress this with `embedders.custom(fn, dim, modelId, { silent: true })`.

### 18.3 Storage isolation

OPFS and IndexedDB are origin-scoped by browser security model. tRAGar inherits this; the `namespace` is a logical separator within an origin, not a security boundary.

### 18.4 No `eval`, no remote code

The JS surface never calls `eval()`, `Function()`, or imports remote code outside of the explicit `embedders.transformers` CDN URL (which is configurable and verifiable).

### 18.5 CSP compatibility

tRAGar runs under a strict CSP if the page allows:

- `script-src` must permit the tragar.js origin (and the transformers.js CDN if used).
- `wasm-unsafe-eval` is required for WASM instantiation.
- `connect-src` must permit the model download origin.
- `worker-src` is not required in v0.1 (no Workers).

---

## 19. Versioning and stability

### 19.1 Semver

tRAGar follows semantic versioning.

- v0.x: breaking changes allowed at minor versions, signaled in CHANGELOG.
- v1.0: stable API. Breaking changes only at major versions.

### 19.2 Stable surfaces in v0.1

These will not change without a major bump after v1.0:

- The `TRAGar.create()` signature
- The `Hit`, `Chunk`, `DocumentMeta` shapes
- `query()`, `ingest()`, `close()` semantics
- The five-seam factory pattern
- The `meta.json` schema (version 1)

### 19.3 Unstable surfaces in v0.1

These may change before v1.0:

- The exact error code list
- The `Stats` shape
- Internal storage file layout (but `meta.json.schemaVersion` will gate any change)
- Default model id and chunker tuning

### 19.4 Migration policy

When `schemaVersion` bumps, tRAGar provides one of:

- An automatic migration on `open()` for trivial upgrades, or
- A `TRAGar.migrate(namespace, fromVersion)` helper for non-trivial upgrades.

Skipping more than one major schema version is unsupported; users must migrate sequentially.

---

## 20. Roadmap

### 20.1 v0.1 — *swallowing* (this spec)

Default seams only. Markdown chunker, transformers.js embedder, OPFS store, flat index, no reranker. Three-line happy path.

### 20.2 v0.2 — *more mouths*

- `embedders.ggml(modelId)` — bundled GGML embedder, zero JS dependencies
- `indexes.hnsw(opts)` — HNSW for corpora >50K
- `embedders.openai(key)` — opt-in cloud embedder with the explicit network warning
- `chunkers.semantic(opts)` — embedding-distance-based chunk boundaries

### 20.3 v0.3 — *better digestion*

- `rerankers.crossEncoder(modelId)` — second-pass reranking
- Worker-based index search, gated on COOP/COEP availability
- `query()` with hybrid sparse+dense (BM25 + embedding)
- Streaming ingestion for huge corpora

### 20.4 v0.4 — *polish*

- C++26 senders/receivers parallel embedding pipeline (when Emscripten libc++ ships P2300)
- Static reflection for chunker/embedder config schemas (P2996)
- The dogfood demo (`microdancing-search`) as a polished published artifact

### 20.5 v1.0 — *stability*

- API freeze
- Full documentation site
- Migration tools
- Public benchmark suite

---

## 21. Open questions

These are deliberately not resolved in this draft. They will be resolved before v0.1 is cut.

1. **Tokenizer for chunking.** Does the markdown chunker reuse the embedder's tokenizer (accurate, requires the embedder to be loaded) or its own approximation (fast, slightly off)? Current default: own approximation. Reconsider after measurements.
2. **Embedder model id default.** `Xenova/all-MiniLM-L6-v2` vs `Xenova/paraphrase-multilingual-MiniLM-L12-v2`. The multilingual model is larger (~120 MB) but better for Spanish. v0.1 defaults to the English-only model with the multilingual one as a one-line opt-in; v0.2 may flip if dogfood usage shows the English model degrading on Spanish corpora.
3. **`ingest()` of binary files.** Should `ingest()` accept `ArrayBuffer | Blob` and handle PDF/DOCX extraction, or stay markdown-only? Current answer: markdown-only in v0.1. PDF/DOCX is a separate library concern.
4. **Worker offload threshold.** At what corpus size does main-thread search become a UX problem? Need real measurements before deciding the v0.3 Worker offload trigger.
5. **The reranker contract for streaming.** Should `queryStream()` rerank the whole top-K before yielding, or interleave? Current default: rerank-all-then-yield. May change after v0.3 ships a reranker.

---

## 22. Companion essay outline

*Not part of the technical spec — kept here as a marker for the prose artifact that ships alongside.*

The companion essay, **"Tragar el corpus — Resonant Coding II,"** argues:

1. The personal corpus (markdown, voice memos, prompts, commit messages) is the most underused asset of any methodology-focused developer.
2. RAG is not an LLM feature; it is a **memory architecture**. The library that owns the memory is the one that shapes the methodology.
3. Self-contained beats clever. The web platform is finally good enough that "ship one wasm and one js" is a complete distribution model. tRAGar is an exercise in taking that seriously.
4. Modern C++ in 2026 is not the dangerous-but-fast language of cliché. It is a quality-forcing function: the discipline required to write SIMD cosine search in the browser is precisely the discipline that makes the rest of the library small, careful, and honest.

The essay drops on the day v0.1 tags.

---

*Fin del documento. End of document.*

