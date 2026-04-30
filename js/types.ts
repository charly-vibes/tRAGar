/**
 * tRAGar public TypeScript types — Slice 1
 *
 * This file is the authoritative contract for the JS/TS public surface.
 * Implementations in tragar.ts must satisfy these interfaces.
 */

// ────────────────────────────────────────────────────────────────────────────
// Error

/** All codes that tRAGar may reject with. */
export type ErrorCode =
  | "InstanceClosed"  // method called after close()
  | "InvalidConfig";  // bad namespace, unsupported config, etc.

// ────────────────────────────────────────────────────────────────────────────
// Store configs

export type StoreMode = "memory" | "opfs" | "indexeddb";

export interface MemoryStoreConfig {
  readonly type: "memory";
}

// ────────────────────────────────────────────────────────────────────────────
// Embedder configs (Slice 1: only custom embedder is in scope)

export interface CustomEmbedderConfig {
  readonly type: "custom";
  readonly dim: number;
  readonly modelId: string;
  embed(batch: string[]): Promise<Float32Array[]>;
}

// ────────────────────────────────────────────────────────────────────────────
// Create config

export interface CreateConfig {
  /** Backing store. Defaults to OPFS; use stores.memory() for the tracer bullet. */
  store: MemoryStoreConfig;
  /** Corpus namespace. Must match /^[a-zA-Z0-9_-]{1,64}$/. Defaults to "default". */
  namespace?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Instance API (Slice 1: lifecycle only)

export interface TRAGarInstance {
  /** Corpus namespace this instance was opened with. */
  readonly namespace: string;
  /** Active backing-store mode ("memory" | "opfs" | "indexeddb"). */
  readonly storeMode: StoreMode;

  /**
   * Release all resources held by this instance.
   * Resolves on success; rejects with TRAGarError("InstanceClosed") if already closed.
   */
  close(): Promise<void>;
}
