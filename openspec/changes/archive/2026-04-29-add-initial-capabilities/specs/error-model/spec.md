<!-- Status: draft | Version: matches SPEC.md v0.1.0-spec | Source: SPEC.md §12 -->

## ADDED Requirements

### Requirement: TRAGarError Base Class
All errors thrown across the JS/C++ boundary SHALL be instances of `TRAGarError`, which extends the native `Error` class. `TRAGarError` MUST expose:
- `code: ErrorCode` — a string literal from the enumerated set below
- `cause?: unknown` — the underlying platform error (DOMException, etc.) when wrapping a lower-level failure

No other error types SHALL cross the public API boundary; all internal errors MUST be mapped to a `TRAGarError` before reaching user code.

#### Scenario: Error is instanceof TRAGarError
- **WHEN** any tRAGar method rejects
- **THEN** the rejection value is an instance of `TRAGarError` with a non-empty `code` property

#### Scenario: Cause chain preserved
- **WHEN** OPFS throws a `DOMException` and the store maps it to `StoreUnavailable`
- **THEN** `error.cause` holds the original `DOMException`

### Requirement: ErrorCode Enumeration
The following error codes SHALL be defined and used exclusively:

| Code | When thrown |
|---|---|
| `StoreUnavailable` | Store cannot be opened or has been closed |
| `StoreCorrupt` | Store data fails integrity checks |
| `SchemaTooNew` | Namespace schema version > library max |
| `SchemaTooOld` | Namespace schema version < library min with no auto-migration |
| `ModelMismatch` | Stored modelId differs from configured embedder |
| `EmbedderUnavailable` | Embedder backend failed to load |
| `EmbedderInputTooLong` | Input exceeded model context after chunker limits |
| `EmbedderRuntimeError` | Inference-time error not covered above |
| `QuotaExceeded` | Browser storage quota exceeded during write |
| `NamespaceLocked` | Namespace is locked by another tab/context |
| `InvalidConfig` | Configuration object fails validation |
| `Internal` | Unexpected internal error (always a bug) |

No other `code` values SHALL appear on `TRAGarError` instances.

#### Scenario: Known code for storage quota
- **WHEN** OPFS throws a quota error during `appendVector()`
- **THEN** the rejected error has `code === 'QuotaExceeded'`

#### Scenario: Internal code signals a bug
- **WHEN** a code path that should be unreachable is reached
- **THEN** the error has `code === 'Internal'` and a descriptive message — this MUST be reported as a bug

### Requirement: C++ to JS Error Bridge
The C++23 core SHALL use `std::expected<T, TRAGarError>` for every fallible operation. The Embind glue layer MUST translate any `unexpected(err)` to a Promise rejection carrying the corresponding JS `TRAGarError`. No C++ exception type SHALL escape the Embind boundary.

#### Scenario: expected failure becomes Promise rejection
- **WHEN** a C++ core function returns `std::unexpected(TRAGarError{StoreCorrupt})`
- **THEN** the calling JS Promise rejects with a `TRAGarError` whose `code === 'StoreCorrupt'`

#### Scenario: C++ exceptions not exposed
- **WHEN** an unexpected C++ exception is thrown inside the Embind boundary
- **THEN** the JS Promise rejects with a `TRAGarError` whose `code === 'Internal'` (never a raw C++ exception type)
