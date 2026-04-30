## 1. Implementation
- [ ] 1.1 Define `NeighborGraph` interface and `NeighborGraphJSON` type in TypeScript
- [ ] 1.2 Implement `TRAGar.buildNeighborGraph(k?)` — O(N²) over stored vectors, default k=10
- [ ] 1.3 Implement `NeighborGraph.neighbors(id)` — O(1) array lookup from prebuilt graph
- [ ] 1.4 Implement `NeighborGraph.neighborsOf(v, k?)` — runtime query for vectors not in vocabulary
- [ ] 1.5 Implement `NeighborGraph.ids()` — return all node ChunkIds
- [ ] 1.6 Implement `NeighborGraph.toJSON()` — produce `NeighborGraphJSON` for embedding in vocab.json
- [ ] 1.7 Benchmark: buildNeighborGraph on 200-token 384-dim corpus must complete < 5 ms
- [ ] 1.8 Write unit tests: neighbors() returns correct top-k, neighborsOf() returns runtime results
- [ ] 1.9 Write integration test: buildNeighborGraph → toJSON → verify NeighborGraphJSON shape
