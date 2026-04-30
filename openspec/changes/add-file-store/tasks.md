## 1. Implementation
- [ ] 1.1 Implement `stores.file(dirPath)` using Node.js `fs` module
- [ ] 1.2 Write to `{dirPath}/tragar/{namespace}/` with the same file layout as OPFS
- [ ] 1.3 Ensure files are byte-identical to `stores.opfs()` output for identical input+config
- [ ] 1.4 Detect browser environment (`typeof navigator !== 'undefined'`) and throw `TRAGarError { code: 'InvalidConfig' }`
- [ ] 1.5 Add Node 22 LTS CI job running `build/generate-vocab.mjs` end-to-end
- [ ] 1.6 Add Playwright CI test validating that `store-file` output opens correctly with `stores.opfs()`
- [ ] 1.7 Write Node unit tests: ingest → file write → verify file layout
- [ ] 1.8 Write round-trip test: stores.file() → stores.opfs() open → query
