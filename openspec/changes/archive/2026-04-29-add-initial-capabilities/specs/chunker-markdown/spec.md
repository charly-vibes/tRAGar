<!-- Status: draft | Version: matches SPEC.md v0.1.0-spec | Source: SPEC.md §5 -->

## ADDED Requirements

### Requirement: CommonMark Parsing
The markdown chunker SHALL parse input text as CommonMark using MD4C. Non-markdown plain text MUST be treated as a single "body" block with no structural splits.

#### Scenario: Structured markdown document
- **WHEN** a document with H1/H2/H3 headings is chunked
- **THEN** each heading section becomes a separate chunk boundary

#### Scenario: Plain text input
- **WHEN** input contains no CommonMark structure
- **THEN** the text is treated as a single body block and chunked by size limits only

### Requirement: Heading Boundary Splits
The chunker SHALL split chunks at heading boundaries. By default, H1, H2, and H3 headings start a new chunk. H4–H6 MUST NOT start a new chunk; they are kept as inline content within the nearest ancestor H1–H3 section. The split depth is configurable via `splitAtHeadings` (1–6, default 3).

#### Scenario: H3 starts new chunk
- **WHEN** the document has an H2 section followed by an H3 subsection
- **THEN** the H3 content is a separate chunk from the H2 content

#### Scenario: H4 remains inline
- **WHEN** `splitAtHeadings = 3` and the document contains H4 headings
- **THEN** H4 content is included in its parent H3 chunk, not split into its own chunk

### Requirement: Token Size Limits
The chunker SHALL target 400 tokens per chunk. The hard maximum is 800 tokens. Chunks that exceed 800 tokens MUST be split with a 50-token overlap. Chunks below 50 tokens MUST be merged with an adjacent sibling (preferring the next sibling). All four limits are configurable.

#### Scenario: Long section split with overlap
- **WHEN** a heading section exceeds 800 tokens
- **THEN** it is split into multiple sub-chunks each with 50-token overlap at boundaries

#### Scenario: Short section merged
- **WHEN** a heading section contains fewer than 50 tokens
- **THEN** it is merged into its next sibling chunk; if no next sibling exists, merged into previous

#### Scenario: Single-section document below minTokens
- **WHEN** the document has exactly one section with fewer than 50 tokens and no siblings exist
- **THEN** the chunk is emitted as-is regardless of token count (no merge target is available)

#### Scenario: Token approximation
- **WHEN** the embedder's tokenizer is unavailable
- **THEN** token count is approximated as `char_count / 4` for English or `char_count / 3.8` for Spanish-majority text

### Requirement: Code Block Atomicity
A fenced code block MUST NOT be split regardless of its token count. If a code block alone exceeds `maxTokens`, it becomes its own oversized chunk and the `onWarn` callback MUST be invoked with an `OversizeChunk` warning.

#### Scenario: Code block stays intact
- **WHEN** a fenced code block of 600 tokens appears inside a 1000-token section
- **THEN** the code block is preserved as a single chunk; surrounding prose is split separately

#### Scenario: Oversized code block warning
- **WHEN** a fenced code block exceeds `maxTokens = 800`
- **THEN** the block becomes one chunk AND `onWarn` receives `{ kind: 'OversizeChunk', ... }`

### Requirement: List Item Handling
A list MUST be kept as one chunk if its total token count is ≤ `maxTokens`. The 30-item figure is a heuristic upper guard, not a hard limit. A list where individual items each exceed `maxTokens` MUST be split one item per chunk.

#### Scenario: Short list as single chunk
- **WHEN** a numbered list has 25 items each under 10 tokens
- **THEN** the entire list is one chunk

#### Scenario: Long-item list split per item
- **WHEN** a list has items each exceeding 100 tokens
- **THEN** each item becomes its own chunk

### Requirement: Spanish Language Awareness
The chunker SHALL be UTF-8 throughout. When the corpus is detected as Spanish-majority (or when `language: 'es'` is set), the following MUST apply:
- Word boundaries include `ñ Ñ ü Ü á é í ó ú Á É Í Ó Ú`
- Sentence boundaries treat `¿ ¡` as sentence-internal markers, not splits
- Token approximation uses `char_count / 3.8` instead of `char_count / 4`

#### Scenario: Spanish word boundaries respected
- **WHEN** chunking Spanish text with accented characters
- **THEN** words like `acción` and `niño` are not broken at the accent character

#### Scenario: Inverted punctuation not a split point
- **WHEN** a paragraph opens with `¿Cómo funciona?`
- **THEN** the `¿` does not create a new sentence boundary

### Requirement: Chunk Identity and Metadata
Each chunk SHALL have a stable `id` computed as SHA-256 of `(source + chunk_index + chunk_text)`. The chunk MUST include `text`, `source`, `line` (1-indexed, first character of chunk in source), `index` (0-indexed position in document), an approximate `tokenCount`, and a `meta` passthrough of user-provided metadata.

#### Scenario: Stable id across re-ingest
- **WHEN** the same document is ingested twice without modification
- **THEN** each chunk has the same `id` both times

#### Scenario: Line number preserved
- **WHEN** a chunk starts at line 42 of the source document
- **THEN** `chunk.line = 42`
