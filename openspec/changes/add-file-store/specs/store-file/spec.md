## ADDED Requirements
### Requirement: File Store Factory
The library SHALL expose `stores.file(dirPath: string): Store` for Node.js environments. The factory MUST write store files to `{dirPath}/tragar/{namespace}/` using the same binary format as `stores.opfs()`: `meta.json`, `vectors.bin`, `scales.bin`, `chunks.jsonl`, `lookup.bin`, and `tombstones.bin`. The files MUST be byte-identical to what `stores.opfs()` would produce for the same data and configuration. When `stores.file()` is called in a browser environment (`typeof navigator !== 'undefined'`), it MUST throw `TRAGarError { code: 'InvalidConfig' }` immediately at call time before any async work.

#### Scenario: file layout matches OPFS format
- **WHEN** `stores.file('/tmp/build')` is used to ingest a corpus in Node.js
- **THEN** the files written under `/tmp/build/tragar/{namespace}/` are byte-identical to the files `stores.opfs()` would produce for the same input

#### Scenario: browser environment throws immediately
- **WHEN** `stores.file('/path')` is called in a browser context
- **THEN** `TRAGarError { code: 'InvalidConfig' }` is thrown synchronously before any async work begins

#### Scenario: written files open in browser
- **WHEN** files written by `stores.file()` in a Node.js build step are served as static assets
- **THEN** a browser `TRAGar` instance using `stores.opfs()` can read and query those files

### Requirement: File Store Node.js CI
The CI matrix SHALL include a Node 22 LTS job that runs the build-time end-to-end flow: ingest → embed → project → write `vocab.json` using `stores.file()`. A subsequent Playwright browser test MUST validate that the written files open correctly with `stores.opfs()` and return correct query results. This job MUST pass before any changes to the store layer or the file store implementation are merged.

#### Scenario: CI end-to-end build job passes
- **WHEN** the CI Node.js job runs `build/generate-vocab.mjs`
- **THEN** it completes without error and produces a valid `vocab.json` and store files

#### Scenario: CI Playwright validation
- **WHEN** the CI Playwright test loads the files written by the Node.js job
- **THEN** `TRAGar.create()` with `stores.opfs()` opens the namespace and `query()` returns correct results
