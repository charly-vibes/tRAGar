/**
 * tRAGar — JavaScript/TypeScript entry point
 *
 * Slice 1: create()/close() lifecycle + stores.memory() factory.
 * The WASM module is not loaded in Slice 1; the memory-store path is
 * implemented in pure JS to prove the API surface before the C++ bridge
 * is wired up in Slice 2.
 */
import type {
  CreateConfig,
  ErrorCode,
  MemoryStoreConfig,
  StoreMode,
  TRAGarInstance,
} from "./types.ts";

// ────────────────────────────────────────────────────────────────────────────
// Error

export class TRAGarError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TRAGarError";
  }
}

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
// Instance (Slice 1: memory store only)

class TRAGarMemoryInstance implements TRAGarInstance {
  readonly namespace: string;
  readonly storeMode: StoreMode = "memory";

  #closed = false;

  constructor(namespace: string) {
    this.namespace = namespace;
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
// create()

async function create(config: CreateConfig): Promise<TRAGarInstance> {
  const namespace = config.namespace ?? "default";
  validateNamespace(namespace);

  switch (config.store.type) {
    case "memory":
      return new TRAGarMemoryInstance(namespace);
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
} as const;
