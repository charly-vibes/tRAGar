/**
 * Slice 6 — OPFS/IndexedDB persistence tests
 *
 * Proves the persist → close → reopen → query roundtrip using an injected
 * MemoryFileBackend so no real browser APIs are needed. Also covers the
 * IndexedDB fallback path and schema version guards.
 */
import { describe, it, expect } from "bun:test";
import { TRAGar, TRAGarError } from "../tragar.ts";
import { MemoryFileBackend } from "../seams/opfs-store.ts";
import type { TRAGarInstance } from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures

const DIM = 4;

function identityEmbed(batch: string[]): Promise<Float32Array[]> {
  return Promise.resolve(
    batch.map((text) => {
      const v = new Float32Array(DIM);
      const slot = Math.abs(simpleHash(text)) % DIM;
      v[slot] = 1.0;
      return v;
    }),
  );
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

const customEmbedder = TRAGar.embedders.custom(identityEmbed, DIM, "test-model-v1");
const DOC_A = { source: "a.md", text: "alpha" };
const DOC_B = { source: "b.md", text: "beta beta beta" };

// ─────────────────────────────────────────────────────────────────────────────
// stores.opfs() factory shape

describe("TRAGar.stores.opfs", () => {
  it("returns a config with type 'opfs'", () => {
    expect(TRAGar.stores.opfs().type).toBe("opfs");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// create() with opfs store

describe("TRAGar.create with opfs store", () => {
  it("resolves to a TRAGarInstance", async () => {
    const backend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
    });
    expect(db).toBeDefined();
    await db.close();
  });

  it("storeMode is 'opfs' with injected backend", async () => {
    const backend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
    });
    expect(db.storeMode).toBe("opfs");
    await db.close();
  });

  it("starts with count 0 on a fresh namespace", async () => {
    const backend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
    });
    expect(db.count).toBe(0);
    await db.close();
  });

  it("exposes the configured namespace", async () => {
    const backend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
      namespace: "my-ns",
    });
    expect(db.namespace).toBe("my-ns");
    await db.close();
  });

  it("exposes modelId and dim from the embedder", async () => {
    const backend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
    });
    expect(db.modelId).toBe("test-model-v1");
    expect(db.dim).toBe(DIM);
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Persistence roundtrip

describe("Persistence roundtrip (close → reopen → query)", () => {
  it("count persists after close/reopen", async () => {
    const backend = new MemoryFileBackend();

    const db1 = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
      namespace: "persist-ns",
    });
    await db1.ingest(DOC_A);
    await db1.ingest(DOC_B);
    const countBefore = db1.count;
    await db1.close();

    const db2 = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
      namespace: "persist-ns",
    });
    expect(db2.count).toBe(countBefore);
    await db2.close();
  });

  it("query returns ingested data after close/reopen", async () => {
    const backend = new MemoryFileBackend();

    const db1 = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
      namespace: "query-ns",
    });
    await db1.ingest(DOC_A);
    await db1.close();

    const db2 = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
      namespace: "query-ns",
    });
    const hits = await db2.query("alpha");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].source).toBe("a.md");
    await db2.close();
  });

  it("accumulated chunks across multiple ingests are all visible after reopen", async () => {
    const backend = new MemoryFileBackend();

    const db1 = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
      namespace: "accum-ns",
    });
    await db1.ingest(DOC_A);
    await db1.close();

    const db2 = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
      namespace: "accum-ns",
    });
    await db2.ingest(DOC_B);
    const count = db2.count;
    await db2.close();

    const db3 = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
      namespace: "accum-ns",
    });
    expect(db3.count).toBe(count);
    await db3.close();
  });

  it("stats() reflects persisted count and storeMode after reopen", async () => {
    const backend = new MemoryFileBackend();

    const db1 = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
      namespace: "stats-ns",
    });
    await db1.ingest(DOC_A);
    await db1.close();

    const db2 = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
      namespace: "stats-ns",
    });
    const s = await db2.stats();
    expect(s.count).toBeGreaterThan(0);
    expect(s.storeMode).toBe("opfs");
    expect(s.namespace).toBe("stats-ns");
    await db2.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// OPFS fallback to IndexedDB

describe("OPFS → IndexedDB fallback", () => {
  it("storeMode is 'indexeddb' when OPFS is unavailable", async () => {
    const fallbackBackend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({
        _simulateOpfsFailure: true,
        _fallbackBackend: fallbackBackend,
      }),
      embedder: customEmbedder,
    });
    expect(db.storeMode).toBe("indexeddb");
    await db.close();
  });

  it("emits onWarn('StoreFallback') when OPFS is unavailable", async () => {
    const fallbackBackend = new MemoryFileBackend();
    const warnings: string[] = [];
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({
        _simulateOpfsFailure: true,
        _fallbackBackend: fallbackBackend,
      }),
      embedder: customEmbedder,
      onWarn: (code) => warnings.push(code),
    });
    expect(warnings).toContain("StoreFallback");
    await db.close();
  });

  it("can ingest and query via IndexedDB fallback", async () => {
    const fallbackBackend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({
        _simulateOpfsFailure: true,
        _fallbackBackend: fallbackBackend,
      }),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_A);
    const hits = await db.query("alpha");
    expect(hits.length).toBeGreaterThan(0);
    await db.close();
  });

  it("IndexedDB fallback persists across close/reopen", async () => {
    const fallbackBackend = new MemoryFileBackend();

    const db1 = await TRAGar.create({
      store: TRAGar.stores.opfs({
        _simulateOpfsFailure: true,
        _fallbackBackend: fallbackBackend,
      }),
      embedder: customEmbedder,
      namespace: "idb-ns",
    });
    await db1.ingest(DOC_A);
    const countBefore = db1.count;
    await db1.close();

    const db2 = await TRAGar.create({
      store: TRAGar.stores.opfs({
        _simulateOpfsFailure: true,
        _fallbackBackend: fallbackBackend,
      }),
      embedder: customEmbedder,
      namespace: "idb-ns",
    });
    expect(db2.count).toBe(countBefore);
    await db2.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema versioning

describe("Schema versioning", () => {
  it("rejects with SchemaTooNew when persisted schemaVersion exceeds library version", async () => {
    const backend = new MemoryFileBackend();
    const meta = JSON.stringify({
      schemaVersion: 9999,
      modelId: "test-model-v1",
      dim: DIM,
      count: 0,
      rawCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await backend.write("meta.json", new TextEncoder().encode(meta));

    const err = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(TRAGarError);
    expect((err as TRAGarError).code).toBe("SchemaTooNew");
  });

  it("opens successfully when schemaVersion matches library version (1)", async () => {
    const backend = new MemoryFileBackend();
    const meta = JSON.stringify({
      schemaVersion: 1,
      modelId: "test-model-v1",
      dim: DIM,
      count: 0,
      rawCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await backend.write("meta.json", new TextEncoder().encode(meta));

    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
    });
    expect(db.count).toBe(0);
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling with opfs store

describe("Error handling with opfs store", () => {
  it("rejects ingest() with TRAGarError after close()", async () => {
    const backend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
    });
    await db.close();
    await expect(db.ingest(DOC_A)).rejects.toBeInstanceOf(TRAGarError);
  });

  it("rejects query() with TRAGarError after close()", async () => {
    const backend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
    });
    await db.close();
    await expect(db.query("alpha")).rejects.toBeInstanceOf(TRAGarError);
  });

  it("rejects close() with TRAGarError when already closed", async () => {
    const backend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
    });
    await db.close();
    await expect(db.close()).rejects.toBeInstanceOf(TRAGarError);
  });

  it("rejects stats() with TRAGarError after close()", async () => {
    const backend = new MemoryFileBackend();
    const db = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: backend }),
      embedder: customEmbedder,
    });
    await db.close();
    await expect(db.stats()).rejects.toBeInstanceOf(TRAGarError);
  });
});
