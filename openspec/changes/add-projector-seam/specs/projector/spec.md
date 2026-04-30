## ADDED Requirements
### Requirement: Projector Interface
The library SHALL expose a `Projector` seam with `inputDim: number`, `outputDim: number`, `fit(matrix, ids)`, `transform(v)`, and `transformMany(matrix)`. `fit()` runs once over the full stored vector matrix and caches the projection basis. `transform()` projects any subsequent query vector into the same cached basis without refitting. `transformMany()` is a batched shortcut for build-time generation steps.

#### Scenario: fit then transform
- **WHEN** `fit(matrix, ids)` is called with a 100×384 matrix
- **THEN** subsequent `transform(v)` calls return a `Float32Array` of length `outputDim` in the cached basis

#### Scenario: transformMany batch shortcut
- **WHEN** `transformMany(matrix)` is called with N vectors
- **THEN** an array of N projected `Float32Array` values is returned, each in the same cached basis as `transform()`

### Requirement: Projector Factories
The library SHALL expose `projectors.pca(outputDim?)`, `projectors.umap(opts?)`, `projectors.identity()`, and `projectors.custom(fit, transform, inputDim, outputDim)`. `pca()` defaults to `outputDim = 2` and uses `ml-pca`. `umap()` uses `umap-js`. `identity()` is a no-op for corpora already in low-dimensional space. Both `pca` and `umap` MUST use dynamic JS imports (`import()`) deferred until the first `fit()` call, so the underlying libraries are excluded from the synchronous module graph and do not affect bundle size for callers that do not use a projector. The `UmapOpts` type SHALL include `seed?: number` for reproducible layouts — callers producing build-time artifacts (e.g. `vocab.json`) MUST set a seed.

#### Scenario: pca default output dimension
- **WHEN** `projectors.pca()` is called with no arguments and fitted on a 384-dim matrix
- **THEN** `outputDim` is 2 and each projected vector has length 2

#### Scenario: identity projector passes through
- **WHEN** `projectors.identity()` is fitted and `transform(v)` is called
- **THEN** the returned vector equals `v` (no modification)

#### Scenario: custom projector
- **WHEN** `projectors.custom(myFit, myTransform, 384, 2)` is created and fitted
- **THEN** `transform()` calls `myTransform` with the input vector

### Requirement: TRAGar Projector Integration
`TRAGarOptions` SHALL accept an optional `projector?: Projector` field. When set, `TRAGar` SHALL expose `project(id)`, `projectAll()`, and `fitProjector()`. `fitProjector()` MUST be called automatically on `create()` if a projector is configured and the namespace already has vectors. Manual calls to `fitProjector()` allow refitting after a large `ingest()`. When no projector is configured, `project()` and `projectAll()` MUST reject with `InvalidConfig`.

#### Scenario: auto-fit on create with existing vectors
- **WHEN** `TRAGar.create({ projector: projectors.pca() })` is called against a namespace with 50 stored vectors
- **THEN** `fitProjector()` runs automatically and `project(id)` returns 2D coords without an explicit `fitProjector()` call

#### Scenario: project single token
- **WHEN** `project(chunkId)` is called after fitting
- **THEN** a `Float32Array` of length `outputDim` is returned for that token's projected position

#### Scenario: projectAll returns full vocab
- **WHEN** `projectAll()` is called after fitting
- **THEN** an array of `{ id: ChunkId; coords: Float32Array }` is returned with one entry per stored chunk

#### Scenario: no projector configured
- **WHEN** `project(id)` is called on an instance created without a `projector` option
- **THEN** the call rejects with `TRAGarError { code: 'InvalidConfig' }`

#### Scenario: project before fit rejects
- **WHEN** `project(id)` is called after `TRAGar.create()` on an empty namespace (no auto-fit occurred) without a prior `fitProjector()` call
- **THEN** the call rejects with `TRAGarError { code: 'InvalidConfig', message: 'projector not fitted — call fitProjector()' }`

#### Scenario: project after ingest without refit rejects
- **WHEN** `fitProjector()` is called on an existing corpus, new chunks are ingested via `ingest()`, then `project(newId)` is called for a newly ingested chunk id
- **THEN** the call rejects with `TRAGarError { code: 'InvalidConfig', message: 'projector basis is stale — call fitProjector() after ingest()' }`
