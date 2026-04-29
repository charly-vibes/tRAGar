# Storage context

## OPFS layout
`tragar/{namespace}/` with files: `meta.json`, `vectors.bin`, `scales.bin`, `chunks.jsonl`, `lookup.bin`, `tombstones.bin`

## Semantics
- Append-only during normal operation
- Deletion = tombstone; `compact()` rewrites dropping tombstoned entries
- Single-writer per namespace (no cross-tab protection in v0.1)
- Automatic fallback to IndexedDB if OPFS unavailable

## Schema versioning
- v0.1 = schema version `1`
- `SchemaTooNew` error if stored version > library version
- Migration via `open()` (automatic, trivial) or `TRAGar.migrate()` (non-trivial)
