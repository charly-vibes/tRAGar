## ADDED Requirements
### Requirement: Clusterer Interface
The library SHALL expose a `Clusterer` seam with `fit(graph: NeighborGraph): Promise<ClusterMap>` and `predict(id: ChunkId): Promise<ClusterAssignment>`. `fit()` takes a `NeighborGraph` (not raw vectors) so spectral methods operate on graph structure and k-means can use projected 2D coordinates. `ClusterAssignment` SHALL have `clusterId: string` and `confidence: number` in [0, 1] (1.0 for manual assignments).

#### Scenario: fit returns cluster map
- **WHEN** `fit(graph)` is called with a built NeighborGraph
- **THEN** a `ClusterMap` (Map<ChunkId, ClusterAssignment>) is returned with one entry per node in the graph

#### Scenario: predict returns assignment
- **WHEN** `predict(id)` is called after fitting
- **THEN** a `ClusterAssignment` with `clusterId` and `confidence` is returned

### Requirement: Clusterer Factories
The library SHALL expose:
- `clusterers.kmeans(k: number, opts?: KMeansOpts)` — standard k-means on projected 2D coordinates
- `clusterers.spectral(opts?: SpectralOpts)` — graph-native spectral clustering
- `clusterers.manual(assignments: Record<string, string>)` — editorial override; named tokens get `confidence: 1.0`, unnamed tokens get `confidence: 0`
- `clusterers.hybrid(auto: Clusterer, overrides: Record<string, string>)` — runs `auto` first then applies named overrides on top

#### Scenario: kmeans assigns k clusters
- **WHEN** `clusterers.kmeans(3)` is fitted on a graph with 100 tokens
- **THEN** all 100 tokens are assigned to one of 3 cluster IDs

#### Scenario: manual confidence 1.0
- **WHEN** `clusterers.manual({ water: 'water', rain: 'water' })` is used
- **THEN** "water" and "rain" chunks have `confidence: 1.0`; all other chunks have `confidence: 0`

#### Scenario: hybrid applies overrides on top of auto
- **WHEN** `clusterers.hybrid(kmeans(3), { shadow: 'boundary' })` is fitted
- **THEN** "shadow" chunk has `clusterId: 'boundary'` with `confidence: 1.0`; all other chunks have assignments from k-means

#### Scenario: spectral uses graph structure
- **WHEN** `clusterers.spectral()` is fitted with a NeighborGraph
- **THEN** clusters reflect the graph connectivity structure without requiring projected coordinates

### Requirement: TRAGar Clusterer Integration
`TRAGarOptions` SHALL accept an optional `clusterer?: Clusterer` field. The instance SHALL expose `cluster(): Promise<ClusterMap>` that calls `clusterer.fit(neighborGraph)` using the most recently built neighbor graph. If `buildNeighborGraph()` has not been called, `cluster()` MUST build the graph internally using default k. If no clusterer is configured, `cluster()` MUST reject with `TRAGarError { code: 'InvalidConfig' }`.

#### Scenario: cluster with pre-built graph
- **WHEN** `buildNeighborGraph()` has been called and then `cluster()` is called
- **THEN** the clusterer fits on the pre-built graph and returns the cluster map

#### Scenario: cluster auto-builds graph
- **WHEN** `cluster()` is called without a prior `buildNeighborGraph()` call
- **THEN** a neighbor graph is built internally with default k before clustering

#### Scenario: no clusterer rejects
- **WHEN** `cluster()` is called on an instance with no `clusterer` option
- **THEN** the call rejects with `TRAGarError { code: 'InvalidConfig' }`
