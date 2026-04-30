/**
 * tRAGar — JavaScript/TypeScript entry point
 *
 * Slice 2: ingest/query/stats on top of the Slice 1 lifecycle skeleton.
 * All logic is pure JS — no WASM in this slice.
 * Vectors are stored as raw float32 (no int8 quantization until the C++ path lands).
 */
import type {
  CreateConfig,
  CustomEmbedderConfig,
  Hit,
  IngestDoc,
  MemoryStoreConfig,
  QueryOptions,
  Stats,
  StoreMode,
  TransformersEmbedderConfig,
  TRAGarInstance,
} from "./types.ts";
import { TRAGarError } from "./errors.ts";
import {
  createTransformersEmbedder,
  DEFAULT_DIM,
  DEFAULT_MODEL,
} from "./seams/transformers-embedder.ts";

// Re-export so callers can import TRAGarError from the public entry point.
export { TRAGarError };

// ────────────────────────────────────────────────────────────────────────────
// Namespace validation (matches SPEC §7.1)

const NAMESPACE_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function validateNamespace(ns: string): void {
  if (!NAMESPACE_RE.test(ns)) {
    throw new TRAGarError(
      "InvalidConfig",
      `Namespace "${ns}" is invalid. Must match /^[a-zA-Z0-9_-]{1,64}$/.`,
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Chunk ID — SHA-256 of (source + ":" + chunkIndex + ":" + text)

async function chunkId(source: string, index: number, text: string): Promise<string> {
  const raw = `${source}:${index}:${text}`;
  const bytes = new TextEncoder().encode(raw);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ────────────────────────────────────────────────────────────────────────────
// Paragraph chunker — split on one or more blank lines, trim, drop empties

function paragraphChunk(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ────────────────────────────────────────────────────────────────────────────
// Vector math — L2-normalize in place, dot product

function l2Normalize(v: Float32Array): void {
  let norm = 0;
  for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < v.length; i++) v[i] /= norm;
  }
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

// ────────────────────────────────────────────────────────────────────────────
// Stored chunk record

interface StoredChunk {
  id: string;
  text: string;
  source: string;
  vector: Float32Array;
}

// ────────────────────────────────────────────────────────────────────────────
// Instance (Slice 2: memory store + ingest/query/stats)

class TRAGarMemoryInstance implements TRAGarInstance {
  readonly namespace: string;
  readonly storeMode: StoreMode = "memory";
  readonly modelId: string;
  readonly dim: number;

  #closed = false;
  #chunks: StoredChunk[] = [];
  #embedder: CustomEmbedderConfig | TransformersEmbedderConfig | undefined;

  constructor(
    namespace: string,
    embedder?: CustomEmbedderConfig | TransformersEmbedderConfig,
  ) {
    this.namespace = namespace;
    this.modelId = embedder?.modelId ?? "";
    this.dim = embedder?.dim ?? 0;
    this.#embedder = embedder;
  }

  get count(): number {
    return this.#chunks.length;
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new TRAGarError("InstanceClosed", "This TRAGar instance has already been closed.");
    }
  }

  #requireEmbedder(): CustomEmbedderConfig | TransformersEmbedderConfig {
    if (!this.#embedder) {
      throw new TRAGarError(
        "InvalidConfig",
        "No embedder configured. Pass embedder: TRAGar.embedders.custom(...) or TRAGar.embedders.transformers() to create().",
      );
    }
    return this.#embedder;
  }

  async ingest(doc: IngestDoc): Promise<void> {
    this.#assertOpen();
    const embedder = this.#requireEmbedder();

    const paragraphs = paragraphChunk(doc.text);
    if (paragraphs.length === 0) return;

    const vectors = await embedder.embed(paragraphs);

    for (let i = 0; i < paragraphs.length; i++) {
      const vec = new Float32Array(vectors[i]);
      l2Normalize(vec);
      const id = await chunkId(doc.source, i, paragraphs[i]);
      this.#chunks.push({ id, text: paragraphs[i], source: doc.source, vector: vec });
    }
  }

  async query(text: string, opts?: QueryOptions): Promise<Hit[]> {
    this.#assertOpen();
    const embedder = this.#requireEmbedder();

    if (this.#chunks.length === 0) return [];

    const k = opts?.k ?? 10;
    const [qvec] = await embedder.embed([text]);
    const query = new Float32Array(qvec);
    l2Normalize(query);

    const scored = this.#chunks.map((c) => ({
      chunkId: c.id,
      text: c.text,
      source: c.source,
      score: dotProduct(query, c.vector),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  async stats(): Promise<Stats> {
    this.#assertOpen();
    return {
      count: this.#chunks.length,
      dim: this.dim,
      modelId: this.modelId,
      storeMode: this.storeMode,
      namespace: this.namespace,
    };
  }

  async close(): Promise<void> {
    if (this.#closed) {
      throw new TRAGarError("InstanceClosed", "This TRAGar instance has already been closed.");
    }
    this.#closed = true;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Store factories

const stores = {
  /** In-memory store — no persistence, ideal for tests and the tracer bullet. */
  memory(): MemoryStoreConfig {
    return { type: "memory" };
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Embedder factories

const embedders = {
  /**
   * Custom embedder — wraps a caller-supplied embed function.
   * Use for tests, examples, and offline development.
   */
  custom(
    embed: (batch: string[]) => Promise<Float32Array[]>,
    dim: number,
    modelId: string,
  ): CustomEmbedderConfig {
    return { type: "custom", dim, modelId, embed };
  },

  /**
   * Transformers.js embedder — lazy-loads the model on first ingest/query call.
   * Defaults to Xenova/all-MiniLM-L6-v2 (English, ~23 MB, dim 384).
   * Throws TRAGarError("EmbedderLoadFailed") if the module or model fails to load.
   */
  transformers(
    modelId: string = DEFAULT_MODEL,
    dim: number = DEFAULT_DIM,
  ): TransformersEmbedderConfig {
    return createTransformersEmbedder(modelId, dim);
  },
};

// ────────────────────────────────────────────────────────────────────────────
// create()

async function create(config: CreateConfig): Promise<TRAGarInstance> {
  const namespace = config.namespace ?? "default";
  validateNamespace(namespace);

  switch (config.store.type) {
    case "memory":
      return new TRAGarMemoryInstance(namespace, config.embedder);
    default: {
      const exhaustive: never = config.store.type;
      throw new TRAGarError("InvalidConfig", `Unsupported store type: ${exhaustive}`);
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Public API

export const TRAGar = {
  create,
  stores,
  embedders,
} as const;
