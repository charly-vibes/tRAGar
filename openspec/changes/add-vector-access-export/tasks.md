## 1. Implementation
- [ ] 1.1 Implement `TRAGar.getVector(id)` — dequantize int8 to float32 on the fly
- [ ] 1.2 Implement `TRAGar.getAllVectors()` — stream full matrix as snapshot array
- [ ] 1.3 Implement `TRAGar.export('json')` — produce `{ meta, chunks, vectors_b64 }` Blob
- [ ] 1.4 Implement `TRAGar.export('binary')` — zip raw OPFS files
- [ ] 1.5 Add `DequantizationRequested` warning to the Warning union
- [ ] 1.6 Fire `DequantizationRequested` warning once per session on first getVector/getAllVectors call
- [ ] 1.7 Write unit tests for getVector round-trip accuracy
- [ ] 1.8 Write integration test: ingest → getAllVectors → verify matrix dimensions
- [ ] 1.9 Write integration test: ingest → export('json') → parse → verify shape
