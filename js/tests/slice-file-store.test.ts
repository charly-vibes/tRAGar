/**
 * File store tests (add-file-store spec)
 *
 * Covers:
 *   - stores.file() factory shape
 *   - Node.js environment detection guard
 *   - ingest → file write → verify file layout on disk
 *   - Round-trip: stores.file() write → stores.opfs() read → query
 */
import { describe, it, expect, afterEach } from "bun:test";
import { TRAGar, TRAGarError } from "../tragar.ts";
import { MemoryFileBackend } from "../seams/opfs-store.ts";
import { tmpdir } from "node:os";
import { mkdir, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures

const DIM = 4;

function identityEmbed(batch: string[]): Promise<Float32Array[]> {
  return Promise.resolve(
    batch.map((text) => {
      const v = new Float32Array(DIM);
      v[Math.abs(simpleHash(text)) % DIM] = 1.0;
      return v;
    }),
  );
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

const customEmbedder = TRAGar.embedders.custom(identityEmbed, DIM, "test-model-v1");
const DOC_A = { source: "a.md", text: "alpha" };
const DOC_B = { source: "b.md", text: "beta beta beta" };

// ─────────────────────────────────────────────────────────────────────────────
// Temp dir management

const tmpDirs: string[] = [];

async function makeTempDir(): Promise<string> {
  const dir = join(tmpdir(), `tragar-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of tmpDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// stores.file() factory shape

describe("TRAGar.stores.file", () => {
  it("returns a config with type 'file'", () => {
    expect(TRAGar.stores.file("/tmp/test").type).toBe("file");
  });

  it("stores the provided dirPath", () => {
    const config = TRAGar.stores.file("/tmp/build");
    expect(config.dirPath).toBe("/tmp/build");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Browser environment detection

describe("stores.file() browser guard", () => {
  it("throws InvalidConfig when process is unavailable", () => {
    const origProcess = globalThis.process;
    try {
      // Simulate browser: delete process from global scope
      Object.defineProperty(globalThis, "process", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      expect(() => TRAGar.stores.file("/tmp/test")).toThrow(TRAGarError);
      expect(() => TRAGar.stores.file("/tmp/test")).toThrow(
        expect.objectContaining({ code: "InvalidConfig" }),
      );
    } finally {
      Object.defineProperty(globalThis, "process", {
        value: origProcess,
        configurable: true,
        writable: true,
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// create() with file store

describe("TRAGar.create with file store", () => {
  it("resolves to a TRAGarInstance", async () => {
    const dir = await makeTempDir();
    const db = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
    });
    expect(db).toBeDefined();
    await db.close();
  });

  it("storeMode is 'file'", async () => {
    const dir = await makeTempDir();
    const db = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
    });
    expect(db.storeMode).toBe("file");
    await db.close();
  });

  it("starts with count 0 on a fresh namespace", async () => {
    const dir = await makeTempDir();
    const db = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
    });
    expect(db.count).toBe(0);
    await db.close();
  });

  it("exposes the configured namespace", async () => {
    const dir = await makeTempDir();
    const db = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
      namespace: "my-ns",
    });
    expect(db.namespace).toBe("my-ns");
    await db.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// File layout verification (task 1.7)

describe("File store layout on disk", () => {
  it("creates tragar/{namespace}/ directory structure", async () => {
    const dir = await makeTempDir();
    const db = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
      namespace: "layout-ns",
    });
    await db.close();

    const nsDir = join(dir, "tragar", "layout-ns");
    const entries = await readdir(nsDir);
    expect(entries).toContain("meta.json");
  });

  it("writes meta.json with correct structure after ingest", async () => {
    const dir = await makeTempDir();
    const db = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
      namespace: "meta-ns",
    });
    await db.ingest(DOC_A);
    await db.close();

    const metaBytes = await readFile(join(dir, "tragar", "meta-ns", "meta.json"), "utf-8");
    const meta = JSON.parse(metaBytes) as Record<string, unknown>;
    expect(meta.schemaVersion).toBe(1);
    expect(meta.modelId).toBe("test-model-v1");
    expect(meta.dim).toBe(DIM);
  });

  it("writes chunks.jsonl with ingested chunk data", async () => {
    const dir = await makeTempDir();
    const db = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
      namespace: "chunks-ns",
    });
    await db.ingest(DOC_A);
    await db.close();

    const chunksText = await readFile(join(dir, "tragar", "chunks-ns", "chunks.jsonl"), "utf-8");
    const lines = chunksText.trim().split("\n").filter(Boolean);
    expect(lines.length).toBeGreaterThan(0);
    const firstChunk = JSON.parse(lines[0]) as Record<string, unknown>;
    expect(firstChunk.source).toBe("a.md");
    expect(firstChunk.text).toBeDefined();
  });

  it("persists across close/reopen", async () => {
    const dir = await makeTempDir();

    const db1 = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
      namespace: "reopen-ns",
    });
    await db1.ingest(DOC_A);
    const countBefore = db1.count;
    await db1.close();

    const db2 = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
      namespace: "reopen-ns",
    });
    expect(db2.count).toBe(countBefore);
    await db2.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Round-trip test: stores.file() → stores.opfs() (task 1.8)
// Loads files written by NodeFsFileBackend into a MemoryFileBackend,
// then opens via stores.opfs() to prove byte-identical format.

describe("Round-trip: stores.file() write → stores.opfs() read", () => {
  it("files written by stores.file() can be read by stores.opfs()", async () => {
    const dir = await makeTempDir();
    const ns = "roundtrip-ns";

    // Write via file store
    const writer = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
      namespace: ns,
    });
    await writer.ingest(DOC_A);
    await writer.ingest(DOC_B);
    const writtenCount = writer.count;
    await writer.close();

    // Read files from disk into MemoryFileBackend
    const nsDir = join(dir, "tragar", ns);
    const fileNames = await readdir(nsDir);
    const memBackend = new MemoryFileBackend();
    for (const name of fileNames) {
      const bytes = await readFile(join(nsDir, name));
      await memBackend.write(name, new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    }

    // Open via opfs (injected backend) and verify
    const reader = await TRAGar.create({
      store: TRAGar.stores.opfs({ _backend: memBackend }),
      embedder: customEmbedder,
      namespace: ns,
    });
    expect(reader.count).toBe(writtenCount);
    const hits = await reader.query("alpha");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].source).toBe("a.md");
    await reader.close();
  });

  it("stats() returns correct storeMode and namespace after round-trip", async () => {
    const dir = await makeTempDir();
    const ns = "rt-stats-ns";

    const writer = await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
      namespace: ns,
    });
    await writer.ingest(DOC_A);
    await writer.close();

    const s = await (await TRAGar.create({
      store: TRAGar.stores.file(dir),
      embedder: customEmbedder,
      namespace: ns,
    })).stats();
    expect(s.storeMode).toBe("file");
    expect(s.namespace).toBe(ns);
    expect(s.count).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling

describe("File store error handling", () => {
  it("rejects with StoreUnavailable for a non-writable path", async () => {
    const err = await TRAGar.create({
      store: TRAGar.stores.file("/proc/nonexistent-tragar-test-path"),
      embedder: customEmbedder,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(TRAGarError);
    expect((err as TRAGarError).code).toBe("StoreUnavailable");
  });
});
