## 1. Implementation
- [ ] 1.1 Define `Clusterer` interface, `ClusterMap`, and `ClusterAssignment` types
- [ ] 1.2 Implement `clusterers.kmeans(k, opts?)` factory
- [ ] 1.3 Implement `clusterers.spectral(opts?)` factory — operates on NeighborGraph structure
- [ ] 1.4 Implement `clusterers.manual(assignments)` factory — editorial override, confidence 1.0
- [ ] 1.5 Implement `clusterers.hybrid(auto, overrides)` — auto first, then pin named tokens
- [ ] 1.6 Extend `TRAGarOptions` with `clusterer?: Clusterer`
- [ ] 1.7 Implement `TRAGar.cluster(): Promise<ClusterMap>`
- [ ] 1.8 Write unit tests for each clusterer factory
- [ ] 1.9 Write integration test: buildNeighborGraph → cluster() → verify all chunks have assignments
