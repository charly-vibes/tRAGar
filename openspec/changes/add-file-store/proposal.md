# Change: Add file store for Node.js build-time use

## Why
The Waste Land Walk requires an offline build step: ingest Part I, embed every token, project to 2D, write `vocab.json`. This is a Node.js script, not a browser session. The v0.1 spec marks Node compatibility as "best-effort and not tested." This addition promotes the store layer to first-class for build-time use.

## What Changes
- Add `stores.file(dirPath)` factory for Node.js environments
- Same binary format as `stores.opfs()` — files are byte-identical and directly deployable
- `stores.file()` throws `InvalidConfig` immediately when called in a browser
- Add Node.js CI job for build-time end-to-end test

## Impact
- Affected specs: store-file (new)
- Affected code: js/tragar.ts, stores namespace, CI configuration
