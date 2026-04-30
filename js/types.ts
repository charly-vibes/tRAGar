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
  | "EmbedderLoadFailed"  // transformers.js model or module failed to load
  | "SchemaTooNew"        // persisted schemaVersion exceeds library support
  | "SchemaTooOld"        // persisted schemaVersion has no migration path
  | "NamespaceLocked";    // another tab/context holds the namespace lock

/** Warning codes emitted via CreateConfig.onWarn. */
export type WarnCode =
  | "StoreFallback"  // OPFS unavailable; fell back to IndexedDB
  | "NamespaceLocked"; // namespace lock could not be acquired (soft warning)

// ────────────────────────────────────────────────────────────────────────────
// Store configs

export type StoreMode = "memory" | "opfs" | "indexeddb";

export interface MemoryStoreConfig {
  readonly type: "memory";
}

/**
 * Minimal file I/O interface used by the OPFS and IndexedDB store backends.
 * Exported so tests can inject a MemoryFileBackend without real browser APIs.
 */
export interface FileBackend {
  read(path: string): Promise<Uint8Array | null>;
  write(path: string, data: Uint8Array): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export interface OpfsStoreConfig {
  readonly type: "opfs";
  /** @internal — inject a pre-scoped backend (skips OPFS setup). Tests only. */
  readonly _backend?: FileBackend;
  /** @internal — simulate OPFS unavailable to exercise the IndexedDB fallback path. Tests only. */
  readonly _simulateOpfsFailure?: boolean;
  /** @internal — backend to use when OPFS is unavailable (or simulated as such). Tests only. */
  readonly _fallbackBackend?: FileBackend;
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
  /** Backing store. Use stores.memory() for tests; stores.opfs() for persistence. */
  store: MemoryStoreConfig | OpfsStoreConfig;
  /**
   * Embedder. Required for ingest() and query().
   * - embedders.custom() — deterministic, no network (tests and dev)
   * - embedders.transformers() — lazy-loads transformers.js on first use (default path)
   * Omitting creates a lifecycle-only instance (close() works; ingest/query reject).
   */
  embedder?: CustomEmbedderConfig | TransformersEmbedderConfig;
  /** Corpus namespace. Must match /^[a-zA-Z0-9_-]{1,64}$/. Defaults to "default". */
  namespace?: string;
  /**
   * Optional callback for non-fatal warnings (e.g. StoreFallback when OPFS is
   * unavailable and the store falls back to IndexedDB).
   */
  onWarn?: (code: WarnCode, message: string) => void;
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
