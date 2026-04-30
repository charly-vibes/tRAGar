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

#### Scenario: includeFrequency attaches count
- **WHEN** `includeFrequency: true` and "rain" appears 7 times
- **THEN** the "rain" chunk has `meta.frequency = 7`

#### Scenario: includeContexts attaches example sentences
- **WHEN** `includeContexts: true` and `maxContexts: 2`
- **THEN** each chunk has `meta.contexts` with at most 2 example sentences containing the word

### Requirement: Vocabulary Chunker Pooling
When pooling per-occurrence embeddings, the vocabulary chunker SHALL embed each occurrence of a word type in its sentence context separately and then combine using the configured `pooling` strategy. Mean pooling (`'mean'`) averages the per-occurrence vectors. Max pooling (`'max'`) takes the element-wise maximum. Mean pooling is the default because it produces more stable cluster geometry for context-dependent words.

#### Scenario: mean pooling default
- **WHEN** `chunkers.vocabulary()` is used with default options and a word appears in 3 sentences
- **THEN** the stored vector is the mean of the 3 contextual embeddings

#### Scenario: max pooling option
- **WHEN** `chunkers.vocabulary({ pooling: 'max' })` is used
- **THEN** the stored vector is the element-wise maximum of the per-occurrence embeddings

### Requirement: Vocabulary Chunk Meta Fields
The `Chunk.meta` type SHALL include optional fields `frequency?: number` (occurrence count in source), `contexts?: string[]` (example sentences), and `tier?: 1 | 2 | 3` (assigned by a Clusterer post-processing step, not by the chunker itself).

#### Scenario: tier field is not set by chunker
- **WHEN** a vocabulary chunk is emitted by `chunkers.vocabulary()`
- **THEN** `chunk.meta.tier` is `undefined` (tier is assigned by the Clusterer, not the chunker)

#### Scenario: meta fields are optional
- **WHEN** `chunkers.vocabulary({ includeFrequency: false, includeContexts: false })` is used
- **THEN** `chunk.meta.frequency` and `chunk.meta.contexts` are both `undefined`
