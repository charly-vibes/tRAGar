/**
 * Slice 2 — Deterministic ingest/query tests
 *
 * Proves the chunk -> embed -> store -> search loop using embedders.custom()
 * and stores.memory(). No network, no WASM, no persistent storage.
 */
import { describe, it, expect, beforeEach } from "bun:test";
import { TRAGar, TRAGarError } from "../tragar.ts";
import type { TRAGarInstance } from "../types.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures

const DIM = 4;

/**
 * Identity embedder: returns a unit vector with a 1.0 at position (hash % DIM).
 * Deterministic — same text always maps to the same slot.
 */
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

// Three fixture docs whose embeddings land on distinct slots
const DOC_A = { source: "a.md", text: "alpha" };         // slot depends on hash
const DOC_B = { source: "b.md", text: "beta beta beta" };
const DOC_C = { source: "c.md", text: "gamma gamma gamma gamma" };

// ─────────────────────────────────────────────────────────────────────────────
// embedders.custom()

describe("TRAGar.embedders.custom", () => {
  it("returns a config with type 'custom'", () => {
    expect(customEmbedder.type).toBe("custom");
  });

  it("carries the supplied dim", () => {
    expect(customEmbedder.dim).toBe(DIM);
  });

  it("carries the supplied modelId", () => {
    expect(customEmbedder.modelId).toBe("test-model-v1");
  });

  it("embed() returns arrays of the declared dim", async () => {
    const result = await customEmbedder.embed(["hello"]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(DIM);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// create() with embedder

describe("TRAGar.create with embedder", () => {
  it("exposes modelId and dim on the instance", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    expect(db.modelId).toBe("test-model-v1");
    expect(db.dim).toBe(DIM);
    await db.close();
  });

  it("starts with count 0", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    expect(db.count).toBe(0);
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ingest()

describe("TRAGarInstance.ingest", () => {
  let db: TRAGarInstance;

  beforeEach(async () => {
    db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
  });

  it("resolves without a value", async () => {
    await expect(db.ingest(DOC_A)).resolves.toBeUndefined();
    await db.close();
  });

  it("increments count by the number of chunks produced", async () => {
    await db.ingest(DOC_A);
    expect(db.count).toBeGreaterThanOrEqual(1);
    await db.close();
  });

  it("count accumulates across multiple ingest() calls", async () => {
    await db.ingest(DOC_A);
    const after1 = db.count;
    await db.ingest(DOC_B);
    expect(db.count).toBeGreaterThan(after1);
    await db.close();
  });

  it("rejects with TRAGarError after close()", async () => {
    await db.close();
    await expect(db.ingest(DOC_A)).rejects.toBeInstanceOf(TRAGarError);
  });

  it("split on blank lines produces multiple chunks for multi-paragraph text", async () => {
    const multiPara = {
      source: "multi.md",
      text: "first paragraph\n\nsecond paragraph\n\nthird paragraph",
    };
    await db.ingest(multiPara);
    expect(db.count).toBe(3);
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// query()

describe("TRAGarInstance.query", () => {
  let db: TRAGarInstance;

  beforeEach(async () => {
    db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_A);
    await db.ingest(DOC_B);
    await db.ingest(DOC_C);
  });

  it("returns an array of hits", async () => {
    const hits = await db.query("alpha");
    expect(Array.isArray(hits)).toBe(true);
    await db.close();
  });

  it("each hit has required fields", async () => {
    const hits = await db.query("alpha");
    expect(hits.length).toBeGreaterThan(0);
    const h = hits[0];
    expect(typeof h.chunkId).toBe("string");
    expect(typeof h.text).toBe("string");
    expect(typeof h.source).toBe("string");
    expect(typeof h.score).toBe("number");
    await db.close();
  });

  it("hits are ordered by descending score", async () => {
    const hits = await db.query("alpha");
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    }
    await db.close();
  });

  it("top hit for 'alpha' is from source a.md", async () => {
    const hits = await db.query("alpha", { k: 1 });
    expect(hits[0].source).toBe("a.md");
    await db.close();
  });

  it("respects the k option", async () => {
    const hits = await db.query("alpha", { k: 2 });
    expect(hits.length).toBeLessThanOrEqual(2);
    await db.close();
  });

  it("returns stable results on repeated identical queries", async () => {
    const hits1 = await db.query("alpha");
    const hits2 = await db.query("alpha");
    expect(hits1.map((h) => h.chunkId)).toEqual(hits2.map((h) => h.chunkId));
    await db.close();
  });

  it("rejects with TRAGarError after close()", async () => {
    await db.close();
    await expect(db.query("alpha")).rejects.toBeInstanceOf(TRAGarError);
  });

  it("returns empty array when no chunks have been ingested", async () => {
    const emptyDb = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    const hits = await emptyDb.query("alpha");
    expect(hits).toHaveLength(0);
    await emptyDb.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// stats()

describe("TRAGarInstance.stats", () => {
  it("returns count, dim, modelId, storeMode, namespace", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
      namespace: "my-ns",
    });
    await db.ingest(DOC_A);
    const s = await db.stats();
    expect(typeof s.count).toBe("number");
    expect(s.dim).toBe(DIM);
    expect(s.modelId).toBe("test-model-v1");
    expect(s.storeMode).toBe("memory");
    expect(s.namespace).toBe("my-ns");
    await db.close();
  });

  it("count in stats() matches instance count", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_A);
    await db.ingest(DOC_B);
    const s = await db.stats();
    expect(s.count).toBe(db.count);
    await db.close();
  });

  it("rejects with TRAGarError after close()", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.close();
    await expect(db.stats()).rejects.toBeInstanceOf(TRAGarError);
  });
});
