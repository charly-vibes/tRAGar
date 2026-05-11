## 1. Implementation
- [x] 1.1 Implement `stores.file(dirPath)` using Node.js `fs` module
- [x] 1.2 Write to `{dirPath}/tragar/{namespace}/` with the same file layout as OPFS
- [x] 1.3 Ensure files are byte-identical to `stores.opfs()` output for identical input+config
- [x] 1.4 Detect browser environment (`typeof process === 'undefined' || !process.versions?.node`) and throw `TRAGarError { code: 'InvalidConfig' }`
- [ ] 1.5 Add Node 22 LTS CI job running `build/generate-vocab.mjs` end-to-end — blocked by add-vocabulary-chunker (generate-vocab.mjs not yet implemented)
- [ ] 1.6 Add Playwright CI test validating that `store-file` output opens correctly with `stores.opfs()` — blocked by 1.5
- [x] 1.7 Write Node unit tests: ingest → file write → verify file layout
- [x] 1.8 Write round-trip test: stores.file() → stores.opfs() open → query
