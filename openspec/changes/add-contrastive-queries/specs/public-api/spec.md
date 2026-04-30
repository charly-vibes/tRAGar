## ADDED Requirements
### Requirement: Contrastive Query Vector Modification
`QueryOptions` SHALL accept `toward?: string | string[] | { terms: string[]; weight: number }` and `awayFrom?: string | string[] | { terms: string[]; weight: number }`. Both options modify the query vector before the SIMD search pass. `toward` shifts the query vector toward the mean of the named terms' stored vectors: `q' = normalize(q + α * mean(toward_vectors))` with default `α = 0.5`. `awayFrom` shifts away: `q' = normalize(q - β * mean(awayFrom_vectors))` with default `β = 0.5`. The two options MAY be combined simultaneously. If any named term is not in the store, the query MUST reject with `TRAGarError { code: 'TermNotFound' }`.

#### Scenario: toward shifts results
- **WHEN** `query('plants', { toward: 'water' })` is called
- **THEN** the cosine score between the modified query vector `q'` and the stored embedding of 'water' is strictly greater than the cosine score between the unmodified query vector `q` and the stored embedding of 'water'

#### Scenario: awayFrom repels results
- **WHEN** `query('the', { awayFrom: ['a', 'an'] })` is called
- **THEN** results are biased away from function words similar to "a" and "an"

#### Scenario: toward and awayFrom compose
- **WHEN** both `toward` and `awayFrom` are set
- **THEN** the query vector is shifted toward named terms and away from repel terms before search

#### Scenario: unknown term rejects
- **WHEN** `toward: 'nonexistent-word'` is used and that term is not in the store
- **THEN** the query rejects with `TRAGarError { code: 'TermNotFound' }`

### Requirement: Boundary Query
`QueryOptions` SHALL accept `boundaryOf?: [string, string]`. When set, the query string is ignored entirely. A synthetic query vector is constructed at the midpoint between the two named terms: `q' = normalize(v_A + v_B)`. Standard top-K cosine search then runs against this midpoint vector to find tokens near the cluster boundary. If either named term is not in the store, the query MUST reject with `TRAGarError { code: 'TermNotFound' }`. Combining `boundaryOf` with `toward` or `awayFrom` in the same query MUST reject with `TRAGarError { code: 'InvalidConfig', message: 'boundaryOf cannot be combined with toward or awayFrom' }`.

#### Scenario: boundaryOf ignores query string
- **WHEN** `query('anything', { boundaryOf: ['water', 'stone'] })` is called
- **THEN** the query string "anything" is not embedded; the midpoint of "water" and "stone" vectors is used instead

#### Scenario: boundaryOf finds cross-cluster candidates
- **WHEN** `boundaryOf: ['water', 'body']` is used on a corpus with clear water and body clusters
- **THEN** returned hits are tokens geometrically near the boundary between those two clusters

#### Scenario: boundaryOf unknown term rejects
- **WHEN** `boundaryOf: ['water', 'nonexistent']` is called
- **THEN** the query rejects with `TRAGarError { code: 'TermNotFound' }`

#### Scenario: boundaryOf combined with toward rejects
- **WHEN** `query('text', { boundaryOf: ['water', 'stone'], toward: 'earth' })` is called
- **THEN** the query rejects with `TRAGarError { code: 'InvalidConfig' }`
