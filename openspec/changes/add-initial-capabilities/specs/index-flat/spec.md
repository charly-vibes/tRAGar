<!-- Status: draft | Version: matches SPEC.md v0.1.0-spec | Source: SPEC.md §8 -->

## ADDED Requirements

### Requirement: Brute-Force SIMD Cosine Search
The flat index SHALL compute approximate cosine similarity between the query vector and all candidate vectors using SIMD int8 dot products. For query vector `q_int8` with scale `q_s` and candidate `d_int8` with scale `d_s`, similarity SHALL be computed as:

```
similarity ≈ dot(q_int8, d_int8) × q_s × d_s
```

The inner loop MUST use `std::simd<int8_t>` processing 16 dimensions per SIMD iteration. For `dim = 384` this totals 24 SIMD iterations per candidate. The dot product MUST accumulate into int32 (not int8 or int16) to avoid overflow; see quantization/spec.md for the required widening strategy.

#### Scenario: Cosine approximation correctness
- **WHEN** a query is run against a 1K synthetic corpus
- **THEN** top-10 agreement with a float32 reference implementation is ≥ 95%

#### Scenario: SIMD required
- **WHEN** the runtime environment does not support WASM SIMD128
- **THEN** the library refuses to load with `Internal: SIMD required`

### Requirement: Top-K Min-Heap
The index SHALL maintain a min-heap of size `K` (default 10) during search. A new candidate score replaces the heap root if and only if it is greater than the current root. After all candidates are scored, hits MUST be drained in descending score order.

#### Scenario: Correct top-K selection
- **WHEN** `search(query, queryScale, k=5, filter=undefined)` is called over a corpus of 100 vectors
- **THEN** exactly 5 hits are returned, ordered highest-score first

#### Scenario: K defaults to 10
- **WHEN** no `k` is specified in `QueryOptions`
- **THEN** at most 10 hits are returned

### Requirement: Pre-Scoring Filter
The index SHALL evaluate the optional `filter` predicate against chunk metadata **before** scoring each candidate. Non-matching candidates MUST be skipped entirely and not included in the top-K heap. The filter shape for v0.1:

```typescript
type Filter = {
  source?: string | string[] | RegExp;
  meta?: Record<string, unknown>;
};
```

`source` filters match against `Chunk.source`. `meta` filters require exact-match equality on all specified keys.

**RegExp boundary:** `RegExp` source filters cannot be passed to C++ via Embind. String and `string[]` source filters MUST be evaluated in C++ before scoring. `RegExp` source filters MUST be evaluated in the JS layer after C++ scoring returns the hit array. `meta` exact-match filters are evaluated in C++.

#### Scenario: Source filter skips non-matching chunks
- **WHEN** `filter = { source: 'readme.md' }` and the corpus has chunks from multiple sources
- **THEN** only chunks with `source === 'readme.md'` are scored; others are skipped

#### Scenario: Meta filter with multiple keys
- **WHEN** `filter = { meta: { lang: 'es', version: 2 } }` is applied
- **THEN** only chunks whose `meta.lang === 'es'` AND `meta.version === 2` are scored

#### Scenario: RegExp source filter applied JS-side
- **WHEN** `filter = { source: /readme\.md$/i }` is applied
- **THEN** C++ scores all candidates (no C++-side source filter is applied for RegExp), and the JS layer filters the returned hits to only those whose `source` matches the RegExp

### Requirement: Index Load from Store
The index SHALL load the full vector matrix from the store into a `std::mdspan<int8_t, 2>` view on `build()`. New vectors added during an active session MUST be made available for search immediately via `add()` without requiring a full rebuild.

#### Scenario: Build from existing corpus
- **WHEN** `index.build(matrix, scales, dim)` is called with a 10K-vector matrix
- **THEN** subsequent `search()` calls are aware of all 10K vectors

#### Scenario: Incremental add
- **WHEN** `index.add(vector, scale, id)` is called after `build()`
- **THEN** the new vector is immediately searchable without calling `build()` again

### Requirement: Query Performance Budget
The index search portion (excluding embedder time and store I/O) MUST complete in under 10 ms for a 10K-vector corpus at `dim = 384`, `K = 10` on a 2020-era device (Apple M1 or equivalent x86). This target is a release blocker enforced by CI benchmarks.

#### Scenario: Index search within 10ms budget
- **WHEN** `search()` is benchmarked in CI on a 10K-vector corpus at dim=384, K=10
- **THEN** p95 latency is under 10 ms; a regression >20% above baseline blocks the merge
