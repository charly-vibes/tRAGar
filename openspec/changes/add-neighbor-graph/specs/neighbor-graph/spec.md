## ADDED Requirements
### Requirement: NeighborGraph Interface
The library SHALL expose a `NeighborGraph` interface with `neighbors(id: ChunkId): Hit[]` (O(1) array lookup), `neighborsOf(v: Float32Array, k?: number): Hit[]` (runtime SIMD search on preloaded matrix), `ids(): ChunkId[]` (all nodes), and `toJSON(): NeighborGraphJSON` (serializable representation). `neighbors()` MUST use the prebuilt adjacency data — no store I/O on the hot path. `neighborsOf()` MUST use the same SIMD index but operates on a pre-loaded matrix rather than the store.

#### Scenario: neighbors returns pre-computed results
- **WHEN** `neighbors(id)` is called on a built graph
- **THEN** the pre-computed k nearest neighbors are returned in O(1) without I/O

#### Scenario: neighborsOf handles runtime query vectors
- **WHEN** `neighborsOf(v, k)` is called with a vector not in the vocabulary
- **THEN** the k nearest stored neighbors are returned using SIMD search on the pre-loaded matrix

#### Scenario: ids returns all nodes
- **WHEN** `ids()` is called on a graph built from N stored chunks
- **THEN** an array of N `ChunkId` values is returned

#### Scenario: toJSON produces serializable graph
- **WHEN** `toJSON()` is called
- **THEN** the result has `{ version: 1, k: number, nodes: [{ id, neighbors: [{ id, score }] }] }`

### Requirement: buildNeighborGraph Method
`TRAGar` SHALL expose `buildNeighborGraph(k?: number): Promise<NeighborGraph>` with a default `k = 10`. The method MUST be O(N²) in vector count. The result SHALL be held in memory and NOT persisted to the store by default. It MAY be serialized via `toJSON()` and written into external build artifacts. For a corpus of 200 tokens at dim=384 the operation MUST complete in under 5 ms.

#### Scenario: default k
- **WHEN** `buildNeighborGraph()` is called with no argument
- **THEN** the graph has `k = 10` neighbors per node

#### Scenario: custom k
- **WHEN** `buildNeighborGraph(5)` is called
- **THEN** the graph has exactly 5 neighbors per node

#### Scenario: performance budget
- **WHEN** `buildNeighborGraph()` is called on a 200-token, dim=384 corpus
- **THEN** the operation completes in under 5 ms

#### Scenario: result not persisted
- **WHEN** `buildNeighborGraph()` is called and then the instance is closed and reopened
- **THEN** the neighbor graph is not available without calling `buildNeighborGraph()` again
