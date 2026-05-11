## 1. Implementation
- [x] 1.1 Implement `TRAGar.getVector(id)` — returns float32 (no int8 in current slice; warn fires)
- [x] 1.2 Implement `TRAGar.getAllVectors()` — snapshot array of { id, v: Float32Array }
- [x] 1.3 Implement `TRAGar.export('json')` — produce `{ meta, chunks, vectors_b64 }` Blob
- [x] 1.4 Implement `TRAGar.export('binary')` — STORE-method zip of meta.json + chunks.jsonl
- [x] 1.5 Add `DequantizationRequested` to WarnCode union; add `NotFound` to ErrorCode
- [x] 1.6 Fire `DequantizationRequested` warning once per instance on first getVector/getAllVectors call
- [x] 1.7 Write unit tests for getVector round-trip accuracy
- [x] 1.8 Write integration test: ingest → getAllVectors → verify matrix dimensions
- [x] 1.9 Write integration test: ingest → export('json') → parse → verify shape
