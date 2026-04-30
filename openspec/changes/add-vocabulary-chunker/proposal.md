# Change: Add vocabulary-mode chunker

## Why
The markdown chunker targets 400-token text passages. The Waste Land Walk needs one float32 vector per unique word type in the corpus — embedding a bare word string is inferior to mean-pooling the embeddings of every occurrence of the word in context.

## What Changes
- Add `chunkers.vocabulary(opts?)` factory
- Add `VocabularyChunkerOpts` type with normalize, minFrequency, includeFrequency, includeContexts, maxContexts, and pooling options
- Extend `Chunk.meta` with optional `frequency`, `contexts`, and `tier` fields

## Impact
- Affected specs: chunker-vocabulary (new), public-api (ingest pipeline behavior for vocabulary chunk pooling)
- Affected code: js/tragar.ts, Chunk type, chunker implementations, ingest pipeline
