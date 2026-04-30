## Context
The Clusterer seam mirrors the five existing seams. It is purely JS-side and operates on the `NeighborGraph` (from `buildNeighborGraph()`) rather than raw vectors. Spectral clustering only needs graph structure; k-means can operate on 2D projected coordinates fetched from the projector.

## Goals / Non-Goals
- Goals: assign cluster labels to all chunks; support editorial overrides via `manual()`; composable via `clusterers.*` factories
- Non-Goals: automatic tier assignment (tier labels are editorial, not cluster-assigned)

## Decisions
- Decision: `fit()` accepts a `NeighborGraph` rather than raw vectors — keeps the seam decoupled from the store and compatible with spectral methods
- Decision: `clusterers.manual()` returns `confidence: 1.0` for all named assignments and `confidence: 0` for unnamed tokens
- Decision: `clusterers.hybrid()` runs the auto clusterer first, then applies overrides on top — most practical for the Walk where a few boundary words need pinning

## Risks / Trade-offs
- Clusterer depends on `NeighborGraph` being pre-built; `cluster()` should document this dependency
- k-means is non-deterministic; seed option recommended for reproducible results

## Open Questions
- Should the clusterer assign tiers or should tier assignment remain editorial? (Recommendation: clusterer assigns clusters, editorial assigns tier labels to cluster IDs)
