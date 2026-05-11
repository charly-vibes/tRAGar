/**
 * Node.js filesystem store seam — provides the FileBackend used by
 * TRAGarPersistentInstance when stores.file() is selected.
 *
 * This module must only be loaded in Node.js environments.
 * The stores.file() factory enforces this via a synchronous guard before
 * any async work begins.
 */
import { TRAGarError } from "../errors.ts";
import type { FileBackend } from "../types.ts";

// Dynamic imports are deferred so bundlers targeting browsers do not attempt
// to resolve node: built-ins at bundle time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadNodeModules(): Promise<{ fs: any; path: any }> {
  const [fs, path] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);
  return { fs, path };
}

class NodeFsFileBackend implements FileBackend {
  constructor(private readonly nsDir: string) {}

  async read(path: string): Promise<Uint8Array | null> {
    const { fs, path: nodePath } = await loadNodeModules();
    try {
      const buf = await fs.readFile(nodePath.join(this.nsDir, path));
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    } catch {
      return null;
    }
  }

  async write(path: string, data: Uint8Array): Promise<void> {
    const { fs, path: nodePath } = await loadNodeModules();
    try {
      await fs.writeFile(nodePath.join(this.nsDir, path), data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRAGarError("StoreUnavailable", msg);
    }
  }

  async exists(path: string): Promise<boolean> {
    const { fs, path: nodePath } = await loadNodeModules();
    try {
      await fs.access(nodePath.join(this.nsDir, path));
      return true;
    } catch {
      return false;
    }
  }
}

export async function openFileBackend(namespace: string, dirPath: string): Promise<FileBackend> {
  const { fs, path } = await loadNodeModules();
  const nsDir = path.join(dirPath, "tragar", namespace);
  try {
    await fs.mkdir(nsDir, { recursive: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new TRAGarError("StoreUnavailable", msg);
  }
  return new NodeFsFileBackend(nsDir);
}
