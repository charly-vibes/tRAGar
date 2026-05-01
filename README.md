# tRAGar

[![tracked with wai](https://img.shields.io/badge/tracked%20with-wai-blue)](https://github.com/charly-vibes/wai)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6)](js/types.ts)

**Client-side Retrieval-Augmented Generation in the browser.**
C++23 compiled to WebAssembly + transformers.js. Zero server. Three lines of code.

## Quick Start

```ts
import { TRAGar } from 'https://charly-vibes.github.io/tRAGar/dist/js/tragar.js';

const rag = await TRAGar.create({
  store: TRAGar.stores.memory(),
  embedder: TRAGar.embedders.transformers(),
});
await rag.ingest({ source: 'notes', text: yourMarkdown });
const hits = await rag.query('what is tRAGar?');
await rag.close();
```

## Features

- **Zero-dependency deploy** — one `.js` file (WASM coming in v0.2), served from any static host
- **Local-first** — vectors live in the browser; no data crosses the network
- **Persistent** — OPFS (or IndexedDB fallback) for cross-reload corpora
- **Composable** — five swappable seams: chunker, embedder, store, index, reranker
- **Spanish-aware** — default chunker handles Spanish prose (UTF-8, accented characters)
- **TypeScript-first** — strict types, async-everywhere public API

## Documentation

| Resource | Link |
|----------|------|
| Getting Started | [charly-vibes.github.io/tRAGar/docs/](https://charly-vibes.github.io/tRAGar/docs/) |
| API Reference | [charly-vibes.github.io/tRAGar/docs/api/](https://charly-vibes.github.io/tRAGar/docs/api/) |
| Interactive Playground | [charly-vibes.github.io/tRAGar/examples/playground/](https://charly-vibes.github.io/tRAGar/examples/playground/) |
| Specification | [SPEC.md](SPEC.md) |

## Development

```bash
just install       # install workspace dependencies
just js-install    # install JS library dependencies
just build-js      # bundle TypeScript → dist/js/tragar.js
just test-js       # run JS unit tests
just docs          # generate API docs → docs/api/
just serve         # serve project over HTTP (port 3456)
```

## License

MIT
