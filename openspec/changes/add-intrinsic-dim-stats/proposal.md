# Change: Add intrinsic dimensionality and neighborhood metrics to stats()

## Why
The Waste Land Walk's core pedagogical claim — "2D isn't enough" — is most compelling when it comes with a concrete number. `stats()` is the natural place to surface intrinsic dimensionality and neighborhood metrics, which can be computed lazily from the neighbor graph.

## What Changes
- Add `intrinsicDim?`, `neighborhoodRadius?`, and `clusterSeparation?` optional fields to the `Stats` type
- The three fields are computed lazily: only present if `buildNeighborGraph()` has already been called
- `intrinsicDim` uses the TwoNN estimator (Facco et al., 2017)
- Performance budget: `stats()` with prebuilt graph must complete in < 10 ms for 200-token corpus

## Depends on
- `add-neighbor-graph` — `intrinsicDim` and `neighborhoodRadius` require a prebuilt neighbor graph
- `add-clusterer-seam` — `clusterSeparation` (Davies-Bouldin index) is only available after `cluster()` has been called

## Impact
- Affected specs: public-api
- Affected code: js/tragar.ts, Stats type, stats() implementation
