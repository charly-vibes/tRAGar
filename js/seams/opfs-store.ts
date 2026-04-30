/**
 * OPFS/IndexedDB store seam — provides the FileBackend used by
 * TRAGarPersistentInstance.
 *
 * In production (browser):
 *   - Tries navigator.storage.getDirectory() → OpfsFileBackend
 *   - Falls back to IndexedDB if OPFS is unavailable
 *
 * In tests:
 *   - Callers inject a MemoryFileBackend via OpfsStoreConfig._backend
 *   - _simulateOpfsFailure forces the IndexedDB fallback path
 */
import { TRAGarError } from "../errors.ts";
import type { FileBackend, OpfsStoreConfig, StoreMode, WarnCode } from "../types.ts";

// ────────────────────────────────────────────────────────────────────────────
// MemoryFileBackend — in-memory implementation for tests

export class MemoryFileBackend implements FileBackend {
  readonly files = new Map<string, Uint8Array>();

  async read(path: string): Promise<Uint8Array | null> {
    return this.files.get(path) ?? null;
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    this.files.set(path, new Uint8Array(data));
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// OpfsFileBackend — wraps a FileSystemDirectoryHandle

class OpfsFileBackend implements FileBackend {
  constructor(private readonly dir: FileSystemDirectoryHandle) {}

  async read(path: string): Promise<Uint8Array | null> {
    try {
      const fh = await this.dir.getFileHandle(path);
      const file = await fh.getFile();
      return new Uint8Array(await file.arrayBuffer());
    } catch {
      return null;
    }
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    const fh = await this.dir.getFileHandle(path, { create: true });
    const w = await fh.createWritable();
    // Copy to a new Uint8Array<ArrayBuffer> to satisfy FileSystemWriteChunkType.
    await w.write(new Uint8Array(data));
    await w.close();
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.dir.getFileHandle(path);
      return true;
    } catch {
      return false;
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// IdbFileBackend — IndexedDB fallback

class IdbFileBackend implements FileBackend {
  constructor(
    private readonly db: IDBDatabase,
    private readonly storeName: string,
  ) {}

  async read(path: string): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readonly");
      const req = tx.objectStore(this.storeName).get(path);
      req.onsuccess = () =>
        resolve(req.result instanceof ArrayBuffer ? new Uint8Array(req.result) : null);
      req.onerror = () => reject(req.error);
    });
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(this.storeName, "readwrite");
      const req = tx.objectStore(this.storeName).put(data.buffer.slice(0), path);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async exists(path: string): Promise<boolean> {
    const val = await this.read(path);
    return val !== null;
  }
}

async function openIndexedDb(namespace: string): Promise<IDBDatabase> {
  const storeName = `tragar.${namespace}.blobs`;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(`tragar.${namespace}`, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(storeName);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// openPersistentBackend — resolves the right backend for the given config

export async function openPersistentBackend(
  namespace: string,
  config: OpfsStoreConfig,
  onWarn?: (code: WarnCode, message: string) => void,
): Promise<{ backend: FileBackend; storeMode: StoreMode }> {
  // Test injection: skip all browser APIs
  if (config._backend && !config._simulateOpfsFailure) {
    return { backend: config._backend, storeMode: "opfs" };
  }

  if (config._simulateOpfsFailure) {
    onWarn?.(
      "StoreFallback",
      "OPFS is unavailable; falling back to IndexedDB. Set storeMode will be 'indexeddb'.",
    );
    if (config._fallbackBackend) {
      return { backend: config._fallbackBackend, storeMode: "indexeddb" };
    }
    // No fallback backend injected — open real IndexedDB
    const idb = await openIndexedDb(namespace);
    return {
      backend: new IdbFileBackend(idb, `tragar.${namespace}.blobs`),
      storeMode: "indexeddb",
    };
  }

  // Production path: try OPFS, fall back to IndexedDB
  try {
    const root = await navigator.storage.getDirectory();
    const tragar = await root.getDirectoryHandle("tragar", { create: true });
    const nsDir = await tragar.getDirectoryHandle(namespace, { create: true });
    return { backend: new OpfsFileBackend(nsDir), storeMode: "opfs" };
  } catch {
    onWarn?.(
      "StoreFallback",
      "OPFS is unavailable; falling back to IndexedDB. Set storeMode will be 'indexeddb'.",
    );
    const idb = await openIndexedDb(namespace);
    return {
      backend: new IdbFileBackend(idb, `tragar.${namespace}.blobs`),
      storeMode: "indexeddb",
    };
  }
}
