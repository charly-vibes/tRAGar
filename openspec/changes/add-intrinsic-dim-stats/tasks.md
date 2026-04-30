## 1. Implementation
- [ ] 1.1 Extend `Stats` type with `intrinsicDim?: number`, `neighborhoodRadius?: number`, `clusterSeparation?: number`
- [ ] 1.2 Implement TwoNN estimator for `intrinsicDim` — requires only nearest two neighbor distances, O(N) given prebuilt graph
- [ ] 1.3 Implement `neighborhoodRadius` — mean distance to k-th neighbor across all nodes in the graph
- [ ] 1.4 Implement `clusterSeparation` — mean inter/intra cluster distance ratio (requires cluster() to have been called)
- [ ] 1.5 Return `undefined` for all three fields when no neighbor graph is available (preserves existing < 5 ms budget)
- [ ] 1.6 Benchmark: stats() with prebuilt 200-token graph must complete < 10 ms
- [ ] 1.7 Write unit tests: TwoNN estimator correctness on known synthetic data
- [ ] 1.8 Write integration test: buildNeighborGraph() → stats() → verify intrinsicDim is defined and > 0
