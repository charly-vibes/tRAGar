## ADDED Requirements
### Requirement: Raw Vector Access
The instance SHALL provide `getVector(id: ChunkId): Promise<Float32Array>` and `getAllVectors(): Promise<{ id: ChunkId; v: Float32Array }[]>`. `getVector()` MUST dequantize stored int8 vectors on the fly using `q[i] * scale` — the raw int8 representation MUST NOT be exposed. `getAllVectors()` returns a snapshot array; it is not a live view. Both methods MUST fire a `DequantizationRequested` warning once per `TRAGar` instance lifetime (not once per browsing context) via `onWarn` to note that float32 reconstruction introduces quantization error.

#### Scenario: getVector returns float32
- **WHEN** `getVector(id)` is called for a stored chunk
- **THEN** a `Float32Array` of length `dim` is returned, dequantized from the stored int8 representation

#### Scenario: getAllVectors returns full matrix snapshot
- **WHEN** `getAllVectors()` is called after ingesting N chunks
- **THEN** an array of N `{ id, v }` objects is returned; `v` is a `Float32Array` of length `dim`

#### Scenario: DequantizationRequested warning fires once
- **WHEN** `getVector()` or `getAllVectors()` is called for the first time in a session
- **THEN** `onWarn` is called with `{ kind: 'DequantizationRequested', count: N }` exactly once per `TRAGar` instance lifetime

#### Scenario: unknown id rejects
- **WHEN** `getVector(unknownId)` is called with an id not in the store
- **THEN** the promise rejects with `TRAGarError { code: 'NotFound' }`

### Requirement: Corpus Export
The instance SHALL provide `export(format: 'json' | 'binary'): Promise<Blob>`. The `'json'` format MUST produce a Blob containing `{ meta, chunks, vectors_b64 }` — human-readable but large. The `'binary'` format MUST produce a zip in the canonical store format — `meta.json`, `vectors.bin`, `scales.bin`, `chunks.jsonl`, `lookup.bin`, `tombstones.bin` — regardless of which backing store (OPFS, IndexedDB, or memory) is in use. The implementation MUST convert from the current backing store to the canonical binary layout; the resulting zip is byte-identical to what `stores.opfs()` would produce for the same data.

#### Scenario: json export shape
- **WHEN** `export('json')` is called after ingesting chunks
- **THEN** the returned Blob parses as JSON with `meta`, `chunks`, and `vectors_b64` fields

#### Scenario: binary export is importable
- **WHEN** `export('binary')` is called and the resulting Blob is extracted
- **THEN** the extracted files are byte-identical to the files that `stores.opfs()` would produce for the same data

#### Scenario: binary export on memory-backed instance
- **WHEN** `export('binary')` is called on a `TRAGar` instance using `stores.memory()`
- **THEN** the returned Blob is a valid zip in canonical store format, byte-identical to what `stores.opfs()` would produce for the same data
