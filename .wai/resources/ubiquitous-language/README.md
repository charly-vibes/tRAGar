# Ubiquitous Language — tRAGar

Terms used consistently across the spec, C++ core, JS API, and docs.

## Core terms

| Term | Definition |
|---|---|
| **Corpus** | The entire collection of source material for one tRAGar instance. A namespace. |
| **Document** | One source unit, identified by a `source` string. Produces zero or more chunks. |
| **Chunk** | Atomic unit of text converted to a single vector. Stable identity within a corpus. |
| **Vector** | Float32 array of dimension `D`. Stored as int8 after quantization. |
| **Embedder** | Function from text to vector. Default delegates to transformers.js. |
| **Store** | Persistent storage for vectors, chunk text, and metadata. |
| **Index** | Structure searched at query time. Default: brute-force SIMD cosine. |
| **Reranker** | Optional second pass over top-K results. Default: identity (none). |
| **Seam** | One of the five replaceable interfaces: chunker, embedder, store, index, reranker. |
| **Hit** | A query result: chunk text, score, source, optional position metadata. |
| **Namespace** | String key under which a corpus is stored. Default: `"default"`. |
| **Schema version** | Integer pinned in stored metadata; bumped when on-disk format changes. |

## Bounded contexts

- [RAG pipeline](contexts/rag-pipeline.md) — ingest and query dataflow
- [Storage](contexts/storage.md) — OPFS/IndexedDB layout and semantics
- [Quantization](contexts/quantization.md) — int8 scheme and accuracy model
