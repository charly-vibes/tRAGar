/**
 * Vector access and export tests (add-vector-access-export)
 *
 * Covers getVector(), getAllVectors(), export('json'), export('binary'),
 * and the DequantizationRequested warning.
 */
import { describe, it, expect, beforeEach } from "bun:test";
import { TRAGar, TRAGarError } from "../tragar.ts";
import type { TRAGarInstance } from "../types.ts";

const DIM = 4;

function identityEmbed(batch: string[]): Promise<Float32Array[]> {
  return Promise.resolve(
    batch.map((text) => {
      const v = new Float32Array(DIM);
      let h = 0;
      for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
      v[Math.abs(h) % DIM] = 1.0;
      return v;
    }),
  );
}

const embedder = TRAGar.embedders.custom(identityEmbed, DIM, "test-model");

const DOC_A = { source: "a.md", text: "alpha document" };
const DOC_B = { source: "b.md", text: "beta text content" };

let db: TRAGarInstance;

beforeEach(async () => {
  db = await TRAGar.create({ store: TRAGar.stores.memory(), embedder });
  await db.ingest(DOC_A);
  await db.ingest(DOC_B);
});

// ── getVector ─────────────────────────────────────────────────────────────────

describe("getVector", () => {
  it("returns a Float32Array of length dim for a known id", async () => {
    const all = await db.getAllVectors();
    const { id } = all[0]!;
    const v = await db.getVector(id);
    expect(v).toBeInstanceOf(Float32Array);
    expect(v.length).toBe(DIM);
  });

  it("rejects with NotFound for an unknown id", async () => {
    await expect(db.getVector("nonexistent-id")).rejects.toMatchObject({ code: "NotFound" });
  });

  it("returns a copy — mutating it does not affect the stored vector", async () => {
    const all = await db.getAllVectors();
    const { id } = all[0]!;
    const v1 = await db.getVector(id);
    v1[0] = 999;
    const v2 = await db.getVector(id);
    expect(v2[0]).not.toBe(999);
  });
});

// ── getAllVectors ─────────────────────────────────────────────────────────────

describe("getAllVectors", () => {
  it("returns one entry per ingested chunk", async () => {
    const all = await db.getAllVectors();
    expect(all.length).toBe(db.count);
  });

  it("each entry has an id string and a Float32Array of length dim", async () => {
    const all = await db.getAllVectors();
    for (const { id, v } of all) {
      expect(typeof id).toBe("string");
      expect(v).toBeInstanceOf(Float32Array);
      expect(v.length).toBe(DIM);
    }
  });

  it("is a snapshot — adding chunks after does not grow the returned array", async () => {
    const snapshot = await db.getAllVectors();
    await db.ingest({ source: "c.md", text: "gamma new document" });
    expect(snapshot.length).toBeLessThan(db.count);
  });
});

// ── DequantizationRequested warning ──────────────────────────────────────────

describe("DequantizationRequested warning", () => {
  it("fires once on first getVector call", async () => {
    const warns: string[] = [];
    const db2 = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder,
      onWarn: (code) => warns.push(code),
    });
    await db2.ingest(DOC_A);
    const [{ id }] = await db2.getAllVectors();
    warns.length = 0; // reset after getAllVectors

    await db2.getVector(id!);
    expect(warns).not.toContain("DequantizationRequested"); // already fired by getAllVectors above
    await db2.close();
  });

  it("fires once per instance lifetime across multiple calls", async () => {
    const warns: string[] = [];
    const db2 = await TRAGar.create({
      store: TRAGar.stores.memory(),
      embedder,
      onWarn: (code) => warns.push(code),
    });
    await db2.ingest(DOC_A);
    await db2.getAllVectors();
    await db2.getAllVectors();
    await db2.getAllVectors();
    expect(warns.filter((c) => c === "DequantizationRequested").length).toBe(1);
    await db2.close();
  });
});

// ── export('json') ────────────────────────────────────────────────────────────

describe("export('json')", () => {
  it("returns a Blob with type application/json", async () => {
    const blob = await db.export("json");
    expect(blob.type).toContain("application/json");
  });

  it("blob parses as JSON with meta, chunks, and vectors_b64 fields", async () => {
    const blob = await db.export("json");
    const text = await blob.text();
    const parsed = JSON.parse(text);
    expect(parsed).toHaveProperty("meta");
    expect(parsed).toHaveProperty("chunks");
    expect(parsed).toHaveProperty("vectors_b64");
  });

  it("meta.count matches the number of stored chunks", async () => {
    const blob = await db.export("json");
    const { meta } = JSON.parse(await blob.text());
    expect(meta.count).toBe(db.count);
  });

  it("chunks array length matches count", async () => {
    const blob = await db.export("json");
    const { chunks } = JSON.parse(await blob.text());
    expect(chunks.length).toBe(db.count);
  });

  it("vectors_b64 decodes to a float32 matrix of the right shape", async () => {
    const blob = await db.export("json");
    const { meta, vectors_b64 } = JSON.parse(await blob.text());
    const raw = atob(vectors_b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const matrix = new Float32Array(bytes.buffer);
    expect(matrix.length).toBe(meta.count * meta.dim);
  });
});

// ── export('binary') ─────────────────────────────────────────────────────────

describe("export('binary')", () => {
  it("returns a Blob with type application/zip", async () => {
    const blob = await db.export("binary");
    expect(blob.type).toBe("application/zip");
  });

  it("zip starts with the PK signature (0x50 0x4B 0x03 0x04)", async () => {
    const blob = await db.export("binary");
    const buf = await blob.arrayBuffer();
    const view = new Uint8Array(buf);
    expect(view[0]).toBe(0x50);
    expect(view[1]).toBe(0x4b);
    expect(view[2]).toBe(0x03);
    expect(view[3]).toBe(0x04);
  });

  it("zip contains meta.json data (searchable in raw bytes)", async () => {
    const blob = await db.export("binary");
    const buf = await blob.arrayBuffer();
    const text = new TextDecoder().decode(new Uint8Array(buf));
    expect(text).toContain("meta.json");
    expect(text).toContain("chunks.jsonl");
  });
});

// ── closed-instance guard ─────────────────────────────────────────────────────

describe("closed instance", () => {
  it("getVector rejects after close()", async () => {
    const all = await db.getAllVectors();
    const { id } = all[0]!;
    await db.close();
    await expect(db.getVector(id)).rejects.toBeInstanceOf(TRAGarError);
  });

  it("getAllVectors rejects after close()", async () => {
    await db.close();
    await expect(db.getAllVectors()).rejects.toBeInstanceOf(TRAGarError);
  });

  it("export rejects after close()", async () => {
    await db.close();
    await expect(db.export("json")).rejects.toBeInstanceOf(TRAGarError);
  });
});
