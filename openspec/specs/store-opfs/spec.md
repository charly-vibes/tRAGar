# store-opfs Specification

## Purpose
TBD - created by archiving change add-initial-capabilities. Update Purpose after archive.
## Requirements
### Requirement: OPFS Filesystem Layout
All tRAGar data SHALL reside under the OPFS root at `tragar/{namespace}/`. For namespace `"default"` this is `tragar/default/`. The directory MUST contain exactly these files:

| File | Purpose | Format |
|---|---|---|
| `meta.json` | Schema version, model, dim, counts, timestamps | JSON |
| `vectors.bin` | Quantized vector matrix | packed `int8`, row-major, `[N × dim]` |
| `scales.bin` | Per-vector quantization scales | packed `float32`, length `N` |
| `chunks.jsonl` | Chunk text and metadata | one JSON object per line |
| `lookup.bin` | Byte offsets into `chunks.jsonl` | packed `uint64`, length `N` |
| `tombstones.bin` | Soft-deleted chunk positions | packed `uint32`; each value is the 0-indexed row position in `vectors.bin` of a deleted entry; only deleted rows are present (sparse) |

#### Scenario: Namespace validation rejects invalid characters
- **WHEN** `TRAGar.create({ namespace: '../etc' })` is called
- **THEN** `create()` rejects with a `TRAGarError` whose `code === 'InvalidConfig'`

#### Scenario: Namespace validation rejects slash
- **WHEN** `TRAGar.create({ namespace: 'foo/bar' })` is called
- **THEN** `create()` rejects with `InvalidConfig`; namespaces containing `/` are disallowed to prevent unexpected subdirectory creation

#### Scenario: Namespace directory created on open
- **WHEN** `store.open('wiki')` is called for the first time (namespace matches `/^[a-zA-Z0-9_-]{1,64}$/`)
- **THEN** the directory `tragar/wiki/` is created under the OPFS root with a fresh `meta.json`

#### Scenario: Correct file layout after ingest
- **WHEN** a document is ingested and the store is inspected
- **THEN** all six files exist under the namespace directory

### Requirement: Append-Only Write Semantics
`vectors.bin`, `scales.bin`, `chunks.jsonl`, and `lookup.bin` SHALL be append-only during normal operation. Deletion MUST set a tombstone in `tombstones.bin` without rewriting the vector matrix. `compact()` MUST rewrite all files, removing tombstoned entries.

#### Scenario: Append does not rewrite
- **WHEN** `appendVector()` is called for a new chunk
- **THEN** the new int8 vector is appended to `vectors.bin` and the file size grows by exactly `dim` bytes

#### Scenario: Delete sets tombstone only
- **WHEN** `delete({ source: 'readme.md' })` is called
- **THEN** `vectors.bin` size is unchanged; `tombstones.bin` gains new entries

#### Scenario: compact() removes tombstones
- **WHEN** `compact()` is called after deleting N chunks
- **THEN** `vectors.bin` shrinks by `N × dim` bytes and `tombstones.bin` is empty

### Requirement: meta.json Schema
`meta.json` SHALL conform to the following shape at schema version 1:

```json
{
  "schemaVersion": 1,
  "modelId": "<string>",
  "dim": "<number>",
  "count": "<number — logical, excluding tombstones>",
  "rawCount": "<number — physical rows including tombstones>",
  "createdAt": "<ISO-8601>",
  "updatedAt": "<ISO-8601>",
  "language": "<'es'|'en'|'auto'>",
  "chunkerConfig": {},
  "embedderConfig": {}
}
```

`meta.json` MUST be updated atomically on every write. `count` and `rawCount` MUST stay accurate.

#### Scenario: meta.json updated after ingest
- **WHEN** a document producing 5 chunks is ingested
- **THEN** `meta.json.count` increases by 5 and `updatedAt` is refreshed

#### Scenario: count vs rawCount after delete
- **WHEN** 3 chunks are soft-deleted from a corpus of 10
- **THEN** `meta.json.count === 7` and `meta.json.rawCount === 10`

### Requirement: Schema Versioning
`meta.json.schemaVersion` is an integer. v0.1 uses schema version `1`. Opening a namespace whose `schemaVersion` exceeds the library's supported version MUST reject with `SchemaTooNew`. Opening a namespace with an older version MUST either auto-migrate on `open()` or reject with `SchemaTooOld` if the migration is not implemented for that version jump.

#### Scenario: SchemaTooNew rejection
- **WHEN** a namespace with `schemaVersion = 99` is opened against a library that supports up to version 1
- **THEN** `store.open()` rejects with an error whose `code === 'SchemaTooNew'`

#### Scenario: SchemaTooOld rejection when no migration available
- **WHEN** a namespace with `schemaVersion = 0` is opened against a library that supports only version 1 and has no migration for version 0
- **THEN** `store.open()` rejects with an error whose `code === 'SchemaTooOld'`

#### Scenario: Future auto-migration on open
- **WHEN** a namespace with `schemaVersion = 1` is opened by a library that supports version 2 and provides a migration
- **THEN** `store.open()` migrates the data to version 2 and resolves successfully

### Requirement: IndexedDB Fallback
When `navigator.storage.getDirectory()` throws (Safari < 16, embedded WebViews, locked-down contexts), the store MUST automatically fall back to IndexedDB with the same logical interface. The fallback uses two object stores:
- `tragar.{namespace}.blobs` — keys are filenames, values are ArrayBuffers
- `tragar.{namespace}.chunks` — keys are chunk IDs, values are chunk records

The fallback MUST be feature-complete. `instance.storeMode` MUST equal `'indexeddb'` when the fallback is active. An `onWarn` call with `StoreFallback` MUST be emitted.

#### Scenario: Automatic fallback when OPFS unavailable
- **WHEN** OPFS is unavailable (navigator.storage.getDirectory throws)
- **THEN** `store.open()` succeeds using IndexedDB, `storeMode === 'indexeddb'`, and `onWarn` fires

#### Scenario: Fallback supports full query roundtrip
- **WHEN** a document is ingested and queried via the IndexedDB fallback
- **THEN** relevant chunks are returned as if OPFS were used

### Requirement: Single-Writer Concurrency Model
The store SHALL assume single-writer semantics per namespace. Each individual write MUST be atomic at the file level (OPFS `createSyncAccessHandle` in a Worker, or atomic-rename on the main thread). Concurrent writes from multiple tabs to the same namespace are explicitly unsupported in v0.1 and MUST NOT be silently corrupted — the store SHOULD emit a `NamespaceLocked` error if a lock file is detected as held by another context.

#### Scenario: Atomic append via async OPFS rename
- **WHEN** `appendVector()` is called on the main thread (v0.1 has no Web Worker)
- **THEN** the write is atomic via the async OPFS API with an atomic-rename pattern (write to `.tmp`, then rename); a concurrent reader observes either the full new row or the previous state, never a partial write. `createSyncAccessHandle()` is NOT used because it is only available inside Web Workers.

#### Scenario: Cross-tab write lock warning
- **WHEN** a second `TRAGar.create()` attempts to open the same namespace already opened by another tab
- **THEN** the second open rejects with `NamespaceLocked` or emits a warning via `onWarn`

