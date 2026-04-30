## ADDED Requirements
### Requirement: Vocabulary Chunker Factory
The library SHALL expose `chunkers.vocabulary(opts?: VocabularyChunkerOpts)` that produces one `Chunk` per unique normalized word type in the input text. The factory SHALL accept `normalize` (default true — lowercase and strip punctuation), `minFrequency` (default 1 — drop types appearing fewer times), `includeFrequency` (default true — attach count to `chunk.meta`), `includeContexts` (default false — attach example sentences), `maxContexts` (default 3), and `pooling` (`'mean'` | `'max'`, default `'mean'`).

#### Scenario: one chunk per unique word type
- **WHEN** `chunkers.vocabulary()` processes text with 50 unique word types
- **THEN** exactly 50 chunks are emitted, one per type

#### Scenario: normalize collapses case variants
- **WHEN** text contains "Water", "water", and "WATER" with `normalize: true`
- **THEN** all three occurrences are merged into a single "water" chunk

#### Scenario: minFrequency drops rare words
- **WHEN** `minFrequency: 3` is set and a word appears only twice
- **THEN** that word type is not emitted as a chunk

#### Scenario: minFrequency higher than any word frequency emits nothing
- **WHEN** `minFrequency: 5` is set on a corpus where no word appears 5 or more times
- **THEN** zero chunks are emitted and a `Warning { kind: 'EmptyVocabulary' }` is fired via `onWarn`

#### Scenario: includeFrequency attaches count
- **WHEN** `includeFrequency: true` and "rain" appears 7 times
- **THEN** the "rain" chunk has `meta.frequency = 7`

#### Scenario: includeContexts attaches example sentences
- **WHEN** `includeContexts: true` and `maxContexts: 2`
- **THEN** each chunk has `meta.contexts` with at most 2 example sentences containing the word

### Requirement: Vocabulary Pooling in the Ingest Pipeline
The vocabulary chunker itself SHALL NOT call the embedder. The chunker collects all occurrence-context sentences for each word type internally and attaches them to `chunk.meta.contexts`. The TRAGar ingest pipeline, when ingesting chunks that carry `chunk.meta.wordType` (identifying them as vocabulary chunks), SHALL embed each context sentence separately using the configured embedder and pool the resulting vectors using the `pooling` strategy configured in the chunker factory. Mean pooling (`'mean'`) computes the element-wise mean of all per-occurrence embeddings and is the default because it produces more stable cluster geometry for context-dependent words. Max pooling (`'max'`) takes the element-wise maximum. The `includeContexts` option controls whether contexts are retained in the persisted chunk metadata; when `false` (default), contexts are used for pooling during ingest then discarded from storage.

#### Scenario: mean pooling default
- **WHEN** `chunkers.vocabulary()` is used with default options and a word appears in 3 sentences
- **THEN** the stored vector is the element-wise mean of the 3 per-context embeddings produced by the ingest pipeline

#### Scenario: max pooling option
- **WHEN** `chunkers.vocabulary({ pooling: 'max' })` is used and a word appears in 3 sentences
- **THEN** the stored vector is the element-wise maximum of the 3 per-context embeddings produced by the ingest pipeline

### Requirement: Vocabulary Chunk Meta Fields
The `Chunk.meta` type SHALL include optional fields `wordType?: string` (normalized word type, set by the vocabulary chunker on every vocabulary chunk — used by the ingest pipeline to identify chunks requiring occurrence pooling), `frequency?: number` (occurrence count in source), `contexts?: string[]` (example sentences, retained in storage only when `includeContexts: true`), and `tier?: number` (assigned by a Clusterer post-processing step, not by the chunker itself).

#### Scenario: tier field is not set by chunker
- **WHEN** a vocabulary chunk is emitted by `chunkers.vocabulary()`
- **THEN** `chunk.meta.tier` is `undefined` (tier is assigned by the Clusterer, not the chunker)

#### Scenario: meta fields are optional
- **WHEN** `chunkers.vocabulary({ includeFrequency: false, includeContexts: false })` is used
- **THEN** `chunk.meta.frequency` and `chunk.meta.contexts` are both `undefined`
