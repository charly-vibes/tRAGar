/**
 * tRAGar public TypeScript types — Slice 2
 *
 * This file is the authoritative contract for the JS/TS public surface.
 * Implementations in tragar.ts must satisfy these interfaces.
 */

// ────────────────────────────────────────────────────────────────────────────
// Error

/** All codes that tRAGar may reject with. */
export type ErrorCode =
  | "InstanceClosed"      // method called after close()
  | "InvalidConfig"       // bad namespace, unsupported config, etc.
  | "EmbedderLoadFailed"; // transformers.js model or module failed to load

// ────────────────────────────────────────────────────────────────────────────
// Store configs

export type StoreMode = "memory" | "opfs" | "indexeddb";

export interface MemoryStoreConfig {
  readonly type: "memory";
}

// ────────────────────────────────────────────────────────────────────────────
// Embedder configs

export interface CustomEmbedderConfig {
  readonly type: "custom";
  readonly dim: number;
  readonly modelId: string;
  embed(batch: string[]): Promise<Float32Array[]>;
}

/**
 * Transformers.js embedder — lazy-loads the model on first embed() call.
 * Throws TRAGarError("EmbedderLoadFailed") if the module or model fails to load.
 */
export interface TransformersEmbedderConfig {
  readonly type: "transformers";
  readonly dim: number;
  readonly modelId: string;
  embed(batch: string[]): Promise<Float32Array[]>;
}

// ────────────────────────────────────────────────────────────────────────────
// Ingest / Query types

/** One document to ingest. source is a stable identifier (path or URL). */
export interface IngestDoc {
  /** Stable identifier for the document (path or URL). */
  readonly source: string;
  /** UTF-8 text content (markdown for v0.1). */
  readonly text: string;
  /** Optional caller-supplied metadata attached to every chunk from this doc. */
  readonly meta?: Record<string, unknown>;
}

/** Options for query(). */
export interface QueryOptions {
  /** Maximum number of hits to return. Defaults to 10. */
  k?: number;
}

/** One retrieval result. */
export interface Hit {
  /** Stable chunk identifier (SHA-256 hex). */
  readonly chunkId: string;
  /** Chunk text as stored. */
  readonly text: string;
  /** Source identifier inherited from the ingested document. */
  readonly source: string;
  /** Cosine similarity score in [0, 1]. Higher is more relevant. */
  readonly score: number;
}

/** Summary returned by stats(). */
export interface Stats {
  readonly count: number;
  readonly dim: number;
  readonly modelId: string;
  readonly storeMode: StoreMode;
  readonly namespace: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Create config

export interface CreateConfig {
  /** Backing store. Use stores.memory() for the tracer bullet and tests. */
  store: MemoryStoreConfig;
  /**
   * Embedder. Required for ingest() and query().
   * - embedders.custom() — deterministic, no network (tests and dev)
   * - embedders.transformers() — lazy-loads transformers.js on first use (default path)
   * Omitting creates a lifecycle-only instance (close() works; ingest/query reject).
   */
  embedder?: CustomEmbedderConfig | TransformersEmbedderConfig;
  /** Corpus namespace. Must match /^[a-zA-Z0-9_-]{1,64}$/. Defaults to "default". */
  namespace?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Instance API (Slice 2: full lifecycle + ingest/query/stats)

export interface TRAGarInstance {
  /** Corpus namespace this instance was opened with. */
  readonly namespace: string;
  /** Active backing-store mode ("memory" | "opfs" | "indexeddb"). */
  readonly storeMode: StoreMode;
  /** Model identifier passed to the embedder. */
  readonly modelId: string;
  /** Embedding dimension. */
  readonly dim: number;
  /** Number of chunks currently stored. Updated after each ingest() call. */
  readonly count: number;

  /**
   * Ingest one document: chunk → embed → store.
   * Resolves when all chunks are stored; rejects with TRAGarError("InstanceClosed") if closed.
   */
  ingest(doc: IngestDoc): Promise<void>;

  /**
   * Query the corpus for the top-k most relevant chunks.
   * Returns an empty array when no chunks have been ingested.
   * Rejects with TRAGarError("InstanceClosed") if closed.
   */
  query(text: string, opts?: QueryOptions): Promise<Hit[]>;

  /**
   * Stream the top-k hits as an async iterator, yielding in descending score order.
   * Safe to abandon with break or an exception — resources are released when the
   * iterator protocol's return() method is called.
   * Throws TRAGarError("InstanceClosed") on first iteration if closed.
   */
  queryStream(text: string, opts?: QueryOptions): AsyncIterable<Hit>;

  /**
   * Return a summary of the current corpus state.
   * Rejects with TRAGarError("InstanceClosed") if closed.
   */
  stats(): Promise<Stats>;

  /**
   * Release all resources held by this instance.
   * Resolves on success; rejects with TRAGarError("InstanceClosed") if already closed.
   */
  close(): Promise<void>;
}
