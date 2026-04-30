/**
 * Slice 3 — transformers.js embedder integration tests
 *
 * Proves the lazy-load path, typed error on failure, and end-to-end
 * ingest/query through the default embedder seam.
 * No real network — @xenova/transformers is mocked at the module boundary.
 */
import { describe, it, expect, mock } from "bun:test";

// ─────────────────────────────────────────────────────────────────────────────
// Module mocks — MUST be declared before any imports that trigger dynamic loads.

const MOCK_DIM = 4;

// Happy-path pipeline mock: returns mean-pooled, L2-normalised float32 output.
const mockPipelineOk = mock(
  async (input: string | string[], _opts?: Record<string, unknown>) => {
    const texts = Array.isArray(input) ? input : [input];
    const data = new Float32Array(texts.length * MOCK_DIM);
    // Slot 0 gets 1.0 per text so after normalisation the vector is [1, 0, 0, 0].
    for (let i = 0; i < texts.length; i++) data[i * MOCK_DIM] = 1.0;
    return { data, dims: [texts.length, MOCK_DIM] };
  },
);

mock.module("@xenova/transformers", () => ({
  pipeline: async (_task: string, _model: string) => mockPipelineOk,
}));

// ─────────────────────────────────────────────────────────────────────────────
// Imports (after mocks so dynamic imports resolve correctly)

import { TRAGar, TRAGarError } from "../tragar.ts";

// ─────────────────────────────────────────────────────────────────────────────
// embedders.transformers() — factory shape

describe("TRAGar.embedders.transformers", () => {
  it("returns a config with type 'transformers'", () => {
    const cfg = TRAGar.embedders.transformers();
    expect(cfg.type).toBe("transformers");
  });

  it("uses the default modelId when none is supplied", () => {
    const cfg = TRAGar.embedders.transformers();
    expect(cfg.modelId).toBe("Xenova/all-MiniLM-L6-v2");
  });

  it("uses the default dim (384) when none is supplied", () => {
    const cfg = TRAGar.embedders.transformers();
    expect(cfg.dim).toBe(384);
  });

  it("respects a custom modelId", () => {
    const cfg = TRAGar.embedders.transformers("my-org/my-model", 768);
    expect(cfg.modelId).toBe("my-org/my-model");
  });

  it("respects a custom dim", () => {
    const cfg = TRAGar.embedders.transformers("my-org/my-model", 768);
    expect(cfg.dim).toBe(768);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// create() with transformers embedder

describe("TRAGar.create with transformers embedder", () => {
  it("exposes modelId and dim from the embedder config", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: TRAGar.embedders.transformers("Xenova/all-MiniLM-L6-v2", MOCK_DIM),
    });
    expect(db.modelId).toBe("Xenova/all-MiniLM-L6-v2");
    expect(db.dim).toBe(MOCK_DIM);
    await db.close();
  });

  it("does NOT call the pipeline on create() — lazy-load only", async () => {
    mockPipelineOk.mockClear();
    await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: TRAGar.embedders.transformers("Xenova/all-MiniLM-L6-v2", MOCK_DIM),
    });
    expect(mockPipelineOk).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lazy-load: pipeline is invoked on first embed call

describe("lazy-loading behaviour", () => {
  it("calls the pipeline only when ingest() is first invoked", async () => {
    mockPipelineOk.mockClear();
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: TRAGar.embedders.transformers("Xenova/all-MiniLM-L6-v2", MOCK_DIM),
    });
    expect(mockPipelineOk).not.toHaveBeenCalled();
    await db.ingest({ source: "doc.md", text: "hello world" });
    expect(mockPipelineOk).toHaveBeenCalledTimes(1);
    await db.close();
  });

  it("reuses the cached pipeline across multiple ingest() calls", async () => {
    mockPipelineOk.mockClear();
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: TRAGar.embedders.transformers("Xenova/all-MiniLM-L6-v2", MOCK_DIM),
    });
    await db.ingest({ source: "a.md", text: "first" });
    await db.ingest({ source: "b.md", text: "second" });
    // pipeline was called twice (once per ingest), but NOT loaded twice
    expect(mockPipelineOk).toHaveBeenCalledTimes(2);
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// End-to-end: ingest + query through the transformers embedder

describe("end-to-end ingest/query with transformers embedder", () => {
  it("ingest() resolves and increments count", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: TRAGar.embedders.transformers("Xenova/all-MiniLM-L6-v2", MOCK_DIM),
    });
    await db.ingest({ source: "doc.md", text: "paragraph one\n\nparagraph two" });
    expect(db.count).toBe(2);
    await db.close();
  });

  it("query() returns hits with required fields", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: TRAGar.embedders.transformers("Xenova/all-MiniLM-L6-v2", MOCK_DIM),
    });
    await db.ingest({ source: "doc.md", text: "hello world" });
    const hits = await db.query("hello");
    expect(hits.length).toBeGreaterThan(0);
    const h = hits[0];
    expect(typeof h.chunkId).toBe("string");
    expect(typeof h.text).toBe("string");
    expect(typeof h.source).toBe("string");
    expect(typeof h.score).toBe("number");
    await db.close();
  });

  it("stats() reflects the transformers embedder", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: TRAGar.embedders.transformers("Xenova/all-MiniLM-L6-v2", MOCK_DIM),
    });
    await db.ingest({ source: "doc.md", text: "hello" });
    const s = await db.stats();
    expect(s.modelId).toBe("Xenova/all-MiniLM-L6-v2");
    expect(s.dim).toBe(MOCK_DIM);
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Typed error on load failure
//
// We simulate load failure by making `pipeline()` (the factory from
// @xenova/transformers) throw. The seam catches this and re-throws as
// TRAGarError("EmbedderLoadFailed").

describe("EmbedderLoadFailed error", () => {
  it("ingest() throws TRAGarError with code EmbedderLoadFailed when the pipeline throws", async () => {
    mock.module("@xenova/transformers", () => ({
      pipeline: async (_task: string, _model: string) => {
        throw new Error("simulated network error");
      },
    }));

    // Fresh embedder so its pipeline cache is empty.
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder: TRAGar.embedders.transformers("Xenova/all-MiniLM-L6-v2", MOCK_DIM),
    });

    const err = await db.ingest({ source: "doc.md", text: "hello" }).catch((e) => e);
    expect(err).toBeInstanceOf(TRAGarError);
    expect((err as TRAGarError).code).toBe("EmbedderLoadFailed");
    await db.close();
  });

  it("embed() on the seam config throws TRAGarError when the pipeline throws", async () => {
    // Tests the seam directly — query() early-returns [] on empty corpus so we
    // exercise the seam via its embed() method instead.
    mock.module("@xenova/transformers", () => ({
      pipeline: async (_task: string, _model: string) => {
        throw new Error("simulated network error");
      },
    }));

    // Fresh embedder config — no cached pipeline.
    const embedder = TRAGar.embedders.transformers("Xenova/all-MiniLM-L6-v2", MOCK_DIM);
    const err = await embedder.embed(["hello"]).catch((e) => e);
    expect(err).toBeInstanceOf(TRAGarError);
    expect((err as TRAGarError).code).toBe("EmbedderLoadFailed");
  });
});
