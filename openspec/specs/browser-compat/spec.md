# browser-compat Specification

## Purpose
TBD - created by archiving change add-initial-capabilities. Update Purpose after archive.
## Requirements
### Requirement: Supported Browser Targets
tRAGar SHALL support the following browsers as first-class targets for v0.1:

| Browser | Minimum version |
|---|---|
| Chromium (Chrome, Edge, Arc, etc.) | ≥ 122 |
| Firefox | ≥ 124 |
| Safari (macOS and iOS) | ≥ 17.4 |
| Mobile Safari | ≥ 17.4 (IndexedDB fallback if OPFS quirks emerge) |

Any behavior that works in the above versions is a supported use case. Any defect that only manifests in older versions is explicitly out of scope.

#### Scenario: Feature detection in target browsers
- **WHEN** tRAGar loads in any of the four target browsers at their minimum versions
- **THEN** all required browser APIs are available and no polyfills are needed

### Requirement: Required Browser Features
The following browser capabilities MUST be present at runtime. tRAGar MUST check for their availability at startup and reject with an appropriate error if any is missing:

- `WebAssembly` with SIMD128 support
- `BigInt`
- `Promise.allSettled`
- `navigator.storage.getDirectory` (OPFS) **OR** `indexedDB` (at least one MUST be present)
- `crypto.subtle.digest` for SHA-256 chunk identity hashing (chunk IDs are computed in the JS layer using `crypto.subtle.digest('SHA-256', ...)`, not the C++ sysroot SHA, to keep WASM binary size smaller)

#### Scenario: All features present — happy path
- **WHEN** tRAGar loads in a fully supported browser
- **THEN** `TRAGar.create()` resolves without error

#### Scenario: Neither OPFS nor IndexedDB available
- **WHEN** both `navigator.storage.getDirectory` and `indexedDB` are unavailable
- **THEN** `TRAGar.create()` rejects with `StoreUnavailable`

### Requirement: SIMD Hard Requirement
WASM SIMD128 is required; there is no scalar fallback. If the runtime does not support SIMD128, tRAGar MUST refuse to load with an `Internal` error whose message explicitly states `SIMD required`. Degrading to a slower scalar path is not an option in v0.1.

#### Scenario: SIMD unavailable — hard rejection
- **WHEN** the WASM runtime does not expose SIMD128 instructions
- **THEN** loading tRAGar throws an error with `code === 'Internal'` and message containing `'SIMD required'`

### Requirement: OPFS to IndexedDB Graceful Degradation
When OPFS is unavailable, the store SHALL automatically fall back to IndexedDB with no API-level change visible to the caller. The transition MUST be transparent: all `Store` interface methods work identically. The `StoreFallback` warning MUST be emitted via `onWarn`. The `storeMode` property MUST reflect the active backend.

#### Scenario: OPFS → IndexedDB transparent fallback
- **WHEN** `navigator.storage.getDirectory` throws and IndexedDB is available
- **THEN** `TRAGar.create()` succeeds, `storeMode === 'indexeddb'`, and `onWarn` fires `StoreFallback`

#### Scenario: Full round-trip works on IndexedDB
- **WHEN** a document is ingested and queried via the IndexedDB backend
- **THEN** query results are equivalent to those from the OPFS backend for the same corpus

### Requirement: CSP Compatibility
tRAGar's JS surface SHALL NOT use `eval()`, `new Function()`, or dynamic code generation. The following CSP directives MUST be sufficient to run tRAGar with the default transformers.js embedder:
- `script-src` must permit the tragar.js origin and the configured transformers.js CDN
- `wasm-unsafe-eval` must be allowed for WASM instantiation
- `connect-src` must permit the model download origin
- `worker-src` is NOT required in v0.1

#### Scenario: No eval in JS surface
- **WHEN** tRAGar runs under a strict CSP with no `unsafe-eval`
- **THEN** tRAGar's own code executes without CSP violations (the `wasm-unsafe-eval` directive covers WASM only)

