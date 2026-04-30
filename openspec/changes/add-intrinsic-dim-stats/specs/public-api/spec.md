## ADDED Requirements
### Requirement: Intrinsic Dimensionality Stats
`stats()` SHALL return three optional fields when a neighbor graph is available: `intrinsicDim?: number` (estimated effective dimensionality via the TwoNN estimator, Facco et al. 2017), `neighborhoodRadius?: number` (mean distance to the k-th nearest neighbor across all stored vectors), and `clusterSeparation?: number` (mean inter-cluster to intra-cluster distance ratio, available only if `cluster()` has been called). All three fields MUST be `undefined` when `buildNeighborGraph()` has not been called, preserving the existing `stats()` performance budget of < 5 ms. When a neighbor graph exists, `stats()` MUST complete in < 10 ms for a 200-token corpus.

#### Scenario: stats without neighbor graph returns undefined fields
- **WHEN** `stats()` is called without a prior `buildNeighborGraph()` call
- **THEN** `intrinsicDim`, `neighborhoodRadius`, and `clusterSeparation` are all `undefined`, and `stats()` completes in < 5 ms

#### Scenario: stats with neighbor graph returns intrinsicDim
- **WHEN** `buildNeighborGraph()` has been called and then `stats()` is called
- **THEN** `stats.intrinsicDim` is a positive number and `stats.neighborhoodRadius` is a positive number

#### Scenario: clusterSeparation requires clustering
- **WHEN** `buildNeighborGraph()` has been called but `cluster()` has not
- **THEN** `stats.clusterSeparation` is `undefined` even though `intrinsicDim` and `neighborhoodRadius` are defined

#### Scenario: performance budget with graph
- **WHEN** `stats()` is called after `buildNeighborGraph()` on a 200-token corpus
- **THEN** the call completes in under 10 ms

#### Scenario: intrinsicDim pedagogical use
- **WHEN** `stats().intrinsicDim` is surfaced to the user for a real-world embedding corpus
- **THEN** the value is meaningfully greater than 2, illustrating that 2D projection loses information
