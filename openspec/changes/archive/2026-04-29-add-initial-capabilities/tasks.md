## 1. Spec authoring
- [x] 1.1 Write `public-api/spec.md` — factory, instance methods, types, seam factories
- [x] 1.2 Write `chunker-markdown/spec.md` — CommonMark splitting, Spanish awareness, chunk shape
- [x] 1.3 Write `embedder-transformers/spec.md` — lazy load, batch shape, error model
- [x] 1.4 Write `store-opfs/spec.md` — file layout, append semantics, schema versioning, fallback
- [x] 1.5 Write `index-flat/spec.md` — SIMD cosine, top-K heap, filter, performance budget
- [x] 1.6 Write `quantization/spec.md` — int8 scheme, procedure, accuracy bounds, storage savings
- [x] 1.7 Write `error-model/spec.md` — TRAGarError, ErrorCode, std::expected bridge
- [x] 1.8 Write `browser-compat/spec.md` — targets, required features, degradation rules

## 2. Validation
- [ ] 2.1 Run `openspec validate add-initial-capabilities --strict` and fix all issues
- [ ] 2.2 Confirm all capabilities appear in `openspec list --specs` after archiving

## 3. Archive
- [ ] 3.1 Archive after approval: `openspec archive add-initial-capabilities --yes`
