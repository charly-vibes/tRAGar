/**
 * Slice 4 — queryStream() async iterator tests
 *
 * Proves the streaming query surface: score-ordered yields, k-cap, empty corpus,
 * early-break lifecycle, typed errors, and end-to-end hit shape.
 * No WASM — same pure-JS path as slices 2 and 3.
 */
import { describe, it, expect } from "bun:test";
import { TRAGar, TRAGarError } from "../tragar.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Test embedder — slot-based, fully predictable scores
//
// Each word maps to one dimension that is set to 1.0; all others 0.
// After L2-normalisation inside the library the vector stays unit.
//
//   "alpha" → [1, 0, 0, 0]    dim 0
//   "beta"  → [0, 1, 0, 0]    dim 1
//   "gamma" → [0, 0, 1, 0]    dim 2
//   (other) → [0, 0, 0, 1]    dim 3 (fallback)
//
// Cosine score for query "alpha" vs stored chunk:
//   alpha-chunk → 1.0 (identical direction)
//   beta-chunk  → 0.0 (orthogonal)
//   gamma-chunk → 0.0 (orthogonal)

const DIM = 4;

const SLOT_MAP: Record<string, number> = {
  alpha: 0,
  beta: 1,
  gamma: 2,
};

function slottedEmbed(batch: string[]): Promise<Float32Array[]> {
  return Promise.resolve(
    batch.map((text) => {
      const v = new Float32Array(DIM);
      const firstWord = text.trim().split(/\s+/)[0];
      const slot = SLOT_MAP[firstWord] ?? 3;
      v[slot] = 1.0;
      return v;
    }),
  );
}

const customEmbedder = TRAGar.embedders.custom(slottedEmbed, DIM, "stream-test-v1");

// Fixture docs — each is a single chunk (no blank lines → no splitting)
const DOC_ALPHA = { source: "a.md", text: "alpha" };
const DOC_BETA  = { source: "b.md", text: "beta" };
const DOC_GAMMA = { source: "c.md", text: "gamma" };

// Helper: collect all hits from an AsyncIterable
async function collectStream(iter: AsyncIterable<import("../types.ts").Hit>): Promise<import("../types.ts").Hit[]> {
  const hits: import("../types.ts").Hit[] = [];
  for await (const h of iter) hits.push(h);
  return hits;
}

// ─────────────────────────────────────────────────────────────────────────────
// queryStream() surface shape

describe("TRAGarInstance.queryStream — surface", () => {
  it("returns an AsyncIterable (has [Symbol.asyncIterator])", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    const stream = db.queryStream("alpha");
    expect(typeof stream[Symbol.asyncIterator]).toBe("function");
    await db.close();
  });

  it("returns an empty sequence when no chunks have been ingested", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    const hits = await collectStream(db.queryStream("alpha"));
    expect(hits).toHaveLength(0);
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Hit shape

describe("TRAGarInstance.queryStream — hit shape", () => {
  it("each hit has chunkId, text, source, score", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_ALPHA);
    const hits = await collectStream(db.queryStream("alpha"));
    expect(hits.length).toBeGreaterThan(0);
    const h = hits[0];
    expect(typeof h.chunkId).toBe("string");
    expect(h.chunkId.length).toBeGreaterThan(0);
    expect(typeof h.text).toBe("string");
    expect(typeof h.source).toBe("string");
    expect(typeof h.score).toBe("number");
    await db.close();
  });

  it("source matches the ingested document source", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_ALPHA);
    const hits = await collectStream(db.queryStream("alpha"));
    expect(hits[0].source).toBe("a.md");
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Score ordering

describe("TRAGarInstance.queryStream — score ordering", () => {
  it("yields hits in descending score order (best match first)", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_ALPHA);
    await db.ingest(DOC_BETA);
    await db.ingest(DOC_GAMMA);

    const hits = await collectStream(db.queryStream("alpha"));

    // Alpha should be first (score 1.0), beta/gamma orthogonal (score 0.0)
    expect(hits[0].source).toBe("a.md");

    // Scores must be non-increasing
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i].score).toBeLessThanOrEqual(hits[i - 1].score);
    }
    await db.close();
  });

  it("streams match the same ordering as query()", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_ALPHA);
    await db.ingest(DOC_BETA);
    await db.ingest(DOC_GAMMA);

    const [streamHits, queryHits] = await Promise.all([
      collectStream(db.queryStream("beta")),
      db.query("beta"),
    ]);

    expect(streamHits.map((h) => h.chunkId)).toEqual(queryHits.map((h) => h.chunkId));
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// k option

describe("TRAGarInstance.queryStream — k option", () => {
  it("yields at most k hits when k is specified", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_ALPHA);
    await db.ingest(DOC_BETA);
    await db.ingest(DOC_GAMMA);

    const hits = await collectStream(db.queryStream("alpha", { k: 1 }));
    expect(hits).toHaveLength(1);
    await db.close();
  });

  it("yields all chunks when k exceeds corpus size", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_ALPHA);
    await db.ingest(DOC_BETA);

    const hits = await collectStream(db.queryStream("alpha", { k: 100 }));
    expect(hits).toHaveLength(2);
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Early-break / cleanup lifecycle

describe("TRAGarInstance.queryStream — lifecycle and cleanup", () => {
  it("early break does not throw", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_ALPHA);
    await db.ingest(DOC_BETA);
    await db.ingest(DOC_GAMMA);

    const seen: import("../types.ts").Hit[] = [];
    for await (const hit of db.queryStream("alpha")) {
      seen.push(hit);
      break; // early exit
    }

    expect(seen).toHaveLength(1);
    await db.close(); // must succeed — no resource held
  });

  it("iterator return() resolves with done:true", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_ALPHA);
    await db.ingest(DOC_BETA);

    const iter = db.queryStream("alpha")[Symbol.asyncIterator]();
    await iter.next(); // consume first hit
    const ret = await iter.return?.();
    expect(ret?.done).toBe(true);

    await db.close();
  });

  it("can iterate a fresh stream after an early break on a previous stream", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_ALPHA);
    await db.ingest(DOC_BETA);

    // First stream — break early
    // eslint-disable-next-line no-unreachable-loop
    for await (const _ of db.queryStream("alpha")) break;

    // Second stream — should work normally
    const hits = await collectStream(db.queryStream("alpha"));
    expect(hits.length).toBeGreaterThan(0);

    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Typed errors

describe("TRAGarInstance.queryStream — typed errors", () => {
  it("throws TRAGarError(InstanceClosed) when instance is already closed", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: customEmbedder,
    });
    await db.ingest(DOC_ALPHA);
    await db.close();

    const err = await collectStream(db.queryStream("alpha")).catch((e) => e);
    expect(err).toBeInstanceOf(TRAGarError);
    expect((err as TRAGarError).code).toBe("InstanceClosed");
  });

  it("throws TRAGarError(InvalidConfig) when no embedder is configured", async () => {
    const db = await TRAGar.create({ store: TRAGar.stores.memory() });

    const err = await collectStream(db.queryStream("alpha")).catch((e) => e);
    expect(err).toBeInstanceOf(TRAGarError);
    expect((err as TRAGarError).code).toBe("InvalidConfig");

    await db.close();
  });
});
