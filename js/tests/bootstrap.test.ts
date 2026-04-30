/**
 * Slice 1 — Bootstrap lifecycle tests
 *
 * Tests the create()/close() surface and stores.memory() factory.
 * Written before the implementation (TDD).
 */
import { describe, it, expect } from "bun:test";
import { TRAGar, TRAGarError } from "../tragar.ts";

describe("TRAGar.stores", () => {
  it("stores.memory() returns a memory store config", () => {
    const store = TRAGar.stores.memory();
    expect(store.type).toBe("memory");
  });
});

describe("TRAGar.create", () => {
  it("returns an instance with storeMode 'memory'", async () => {
    const db = await TRAGar.create({ store: TRAGar.stores.memory() });
    expect(db.storeMode).toBe("memory");
    await db.close();
  });

  it("uses 'default' namespace when not specified", async () => {
    const db = await TRAGar.create({ store: TRAGar.stores.memory() });
    expect(db.namespace).toBe("default");
    await db.close();
  });

  it("uses a custom namespace when specified", async () => {
    const db = await TRAGar.create({
      store: TRAGar.stores.memory(),
      namespace: "my-corpus",
    });
    expect(db.namespace).toBe("my-corpus");
    await db.close();
  });

  it("rejects a namespace that is empty", async () => {
    await expect(
      TRAGar.create({ store: TRAGar.stores.memory(), namespace: "" })
    ).rejects.toBeInstanceOf(TRAGarError);
  });

  it("rejects a namespace with illegal characters", async () => {
    await expect(
      TRAGar.create({
        store: TRAGar.stores.memory(),
        namespace: "bad/namespace",
      })
    ).rejects.toBeInstanceOf(TRAGarError);
  });

  it("rejects a namespace longer than 64 characters", async () => {
    await expect(
      TRAGar.create({
        store: TRAGar.stores.memory(),
        namespace: "a".repeat(65),
      })
    ).rejects.toBeInstanceOf(TRAGarError);
  });
});

describe("TRAGarInstance.close", () => {
  it("close() resolves without a value", async () => {
    const db = await TRAGar.create({ store: TRAGar.stores.memory() });
    await expect(db.close()).resolves.toBeUndefined();
  });

  it("close() a second time rejects with TRAGarError", async () => {
    const db = await TRAGar.create({ store: TRAGar.stores.memory() });
    await db.close();
    await expect(db.close()).rejects.toBeInstanceOf(TRAGarError);
  });

  it("close() error has code 'InstanceClosed'", async () => {
    const db = await TRAGar.create({ store: TRAGar.stores.memory() });
    await db.close();
    try {
      await db.close();
      throw new Error("expected rejection");
    } catch (err) {
      expect(err).toBeInstanceOf(TRAGarError);
      expect((err as TRAGarError).code).toBe("InstanceClosed");
    }
  });
});
