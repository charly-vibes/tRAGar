# Project Context

## Purpose

**tRAGar** is a client-side Retrieval-Augmented Generation library for the browser. It compiles a C++23 core to WebAssembly and exposes a small, opinionated JavaScript/TypeScript surface that does end-to-end RAG: chunk → embed → store → search → (optionally) rerank.

The name combines *tragar* (Spanish: "to swallow") and **RAG**. The corpus gets swallowed; the answer is retrieved.

Full specification: `SPEC.md`.

## Tech Stack

- **C++23** — core logic (chunking, quantization, indexing, SIMD cosine)
- **Emscripten 3.1.x** — compiles C++ to WebAssembly (`-std=c++23 -O3 -msimd128 -flto`)
- **Embind** — C++ → JS/TS marshaling layer
- **TypeScript** — public JS API surface (`js/tragar.ts`)
- **transformers.js** (`Xenova/all-MiniLM-L6-v2`) — default embedder, 384-dim float32
- **MD4C** — CommonMark parser for the markdown chunker
- **OPFS / IndexedDB** — browser storage backends
- **CMake + vcpkg** — build system (native testing)
- **Catch2 v3** — C++ unit tests
- **Playwright** — browser smoke and integration tests
- **GitHub Actions** — CI (GCC 14, Clang 19, Emscripten, browser matrix)

## Project Conventions

### Code Style

- C++: `clang-format` enforced, `clang-tidy` with `bugprone-*`, `cppcoreguidelines-*`, `modernize-*`
- TypeScript: strict mode
- Spell checking: `_typos.toml` (Spanish terms and domain vocabulary allowlisted)
- `.editorconfig` governs indentation for all file types

### Architecture Patterns

Five composable seams — each defaults to a sensible implementation but is fully replaceable:

| Seam | Default | Interface |
|------|---------|-----------|
| Chunker | `chunkers.markdown()` | `AsyncIterable<Chunk>` |
| Embedder | `embedders.transformers('Xenova/all-MiniLM-L6-v2')` | `embed(batch): Promise<Float32Array[]>` |
| Store | `stores.opfs('default')` | OPFS with IndexedDB fallback |
| Index | `indexes.flat()` | brute-force SIMD cosine, `std::mdspan` |
| Reranker | `rerankers.none` | identity pass-through |

Four layers: JS API surface → Embind glue → C++23 core → Platform bindings.

All errors are `TRAGarError` subclasses with typed `ErrorCode`. C++ uses `std::expected<T, TRAGarError>` for every fallible operation.

### Testing Strategy

- **Unit**: Catch2 v3, native C++, golden corpora for chunker, round-trip for quantizer, top-K agreement for index
- **Browser smoke**: Playwright — three-line happy path, persistence round-trip, OPFS fallback path
- **Golden retrieval**: 200-doc Spanish corpus, 50 hand-written queries, ≥80% top-1 accuracy required
- **Benches**: `bench/` run in CI; >20% regression on any performance budget blocks merge
- **Determinism**: byte-identical store files for identical input+config

### Git Workflow

- Conventional commits (`chore:`, `feat:`, `fix:`, `bench:`, `test:`, `docs:`)
- `/commit` skill for structured commits
- Main branch: `main`
- PR-based changes; CI must pass before merge

## Domain Context

- **Local-first**: no data crosses network by default; vectors and chunks live in the browser
- **Spanish-aware**: UTF-8 throughout, Unicode word boundaries including `ñ Ñ ü á é í ó ú`, `char_count / 3.8` token approximation for Spanish-majority corpora
- **Quantization**: symmetric int8, per-vector, post-normalization; `cosine(a,b) ≈ dot(q_a,q_b)*s_a*s_b`; ~4× storage reduction vs float32
- **Schema versioning**: `meta.json.schemaVersion` integer; v0.1 = schema 1
- **Namespace**: logical key for corpus isolation within an origin; not a security boundary

## Important Constraints

- **WASM SIMD required** — no scalar fallback; tRAGar refuses to load without SIMD128
- **Single-writer per namespace** — no concurrent multi-tab write protection in v0.1
- **Target browsers**: Chromium ≥ 122, Firefox ≥ 124, Safari ≥ 17.4
- **Bundle size**: WASM ≤ 400 KB gzipped (excluding transformers.js)
- **Performance budgets** (release blockers):
  - `create()` empty namespace: < 50 ms
  - `query()` end-to-end 10K chunks: < 50 ms
  - `query()` index portion only: < 10 ms
- **No eval, no remote code** in the JS surface (CSP-compatible)
- **v0.1 scope**: markdown chunker + transformers.js embedder + flat index only; HNSW, cross-encoder reranker, Worker offload are v0.2/v0.3

## External Dependencies

- **transformers.js CDN** (`cdn.jsdelivr.net/npm/@xenova/transformers@2.x`) — loaded lazily on first embed; model cached in browser Cache Storage
- **GitHub Pages** — first-class hosting target for the distributed `.wasm` + `.js`
- **MD4C** — vendored CommonMark parser
