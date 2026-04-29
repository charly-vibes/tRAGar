# RAG Pipeline context

## Ingestion flow
`ingest(text, meta)` → chunker → embedder (batch=16) → normalize → quantize int8 → store append → index update

## Query flow
`query(text, opts)` → chunker (first chunk only) → embedder → normalize → quantize → SIMD cosine → top-K heap → reranker → `Hit[]`

## Key invariants
- Vectors are unit-normalized **before** quantization
- Chunk identity is SHA-256 of `(source + chunk_index + chunk_text)` — stable across re-ingest
- Duplicate chunks (same hash) are skipped on re-ingest
- Embedder is loaded lazily on first use, not on `create()`
