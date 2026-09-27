import { describe, expect, it } from "vitest";
import { createEmptyWorldSaveV1 } from "./WorldSaveSchema";
import {
  createStoredWorldSaveRecord,
  IndexedDbWorldSaveRepository,
  StoredWorldSaveRecord,
  validateStoredWorldSaveRecord,
  WorldSaveRepository,
} from "./WorldSaveRepository";

class MemoryRepository implements WorldSaveRepository {
  private value: unknown;
  failWrites = false;
  async getCurrent() { return this.value; }
  async putCurrent(record: StoredWorldSaveRecord) {
    if (this.failWrites) throw new Error("transaction aborted");
    this.value = structuredClone(record);
  }
  async deleteCurrent() { this.value = undefined; }
}

function startedSave() {
  const save = createEmptyWorldSaveV1();
  save.world.started = true;
  return save;
}

function fakeIndexedDb() {
  const values = new Map<IDBValidKey, unknown>();
  let failWrite = false;
  const db: any = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    close: () => undefined,
    transaction: () => {
      const tx: any = { error: new Error("mock IndexedDB transaction failed") };
      tx.objectStore = () => ({
        get: (key: IDBValidKey) => {
          const request: any = { result: values.get(key), error: undefined };
          queueMicrotask(() => request.onsuccess?.({ target: request }));
          return request;
        },
        put: (value: unknown, key: IDBValidKey) => {
          queueMicrotask(() => {
            if (failWrite) tx.onerror?.({ target: tx });
            else {
              values.set(key, structuredClone(value));
              tx.oncomplete?.({ target: tx });
            }
          });
          return 1;
        },
        delete: (key: IDBValidKey) => {
          queueMicrotask(() => {
            values.delete(key);
            tx.oncomplete?.({ target: tx });
          });
          return 1;
        },
      });
      return tx;
    },
  };
  const factory = {
    open: () => {
      const request: any = { result: db, error: undefined };
      queueMicrotask(() => request.onsuccess?.({ target: request }));
      return request;
    },
  };
  return { factory: factory as unknown as IDBFactory, values, failWrite: (value: boolean) => { failWrite = value; } };
}

describe("single current-save repository contract", () => {
  it("supports empty, put/get equivalence, atomic replacement, and delete", async () => {
    const repository = new MemoryRepository();
    expect(await repository.getCurrent()).toBeUndefined();
    const first = createStoredWorldSaveRecord(startedSave(), "First", "2026-01-01T00:00:00.000Z");
    await repository.putCurrent(first);
    expect(await repository.getCurrent()).toEqual(first);
    const replacement = createStoredWorldSaveRecord(startedSave(), "Second", "2026-01-02T00:00:00.000Z");
    await repository.putCurrent(replacement);
    expect(await repository.getCurrent()).toEqual(replacement);
    await repository.deleteCurrent();
    expect(await repository.getCurrent()).toBeUndefined();
  });

  it("propagates write failures and leaves the previous record intact", async () => {
    const repository = new MemoryRepository();
    const first = createStoredWorldSaveRecord(startedSave(), "Keep");
    await repository.putCurrent(first);
    repository.failWrites = true;
    await expect(repository.putCurrent(createStoredWorldSaveRecord(startedSave(), "Failed")))
      .rejects.toThrow("transaction aborted");
    expect(await repository.getCurrent()).toEqual(first);
  });

  it("rejects unsupported schema and malformed save records", () => {
    const record = createStoredWorldSaveRecord(startedSave());
    expect(validateStoredWorldSaveRecord(record).valid).toBe(true);
    expect(validateStoredWorldSaveRecord({ ...record, saveSchemaVersion: 999 }).errors).toContain("该存档版本暂不支持");
    expect(validateStoredWorldSaveRecord({ ...record, save: [] }).valid).toBe(false);
  });

  it("resolves writes only on transaction completion and propagates transaction errors", async () => {
    const indexed = fakeIndexedDb();
    const repository = new IndexedDbWorldSaveRepository(indexed.factory);
    const record = createStoredWorldSaveRecord(startedSave(), "Atomic");
    await repository.putCurrent(record);
    expect(await repository.getCurrent()).toEqual(record);
    indexed.failWrite(true);
    await expect(repository.putCurrent(createStoredWorldSaveRecord(startedSave(), "Rejected")))
      .rejects.toThrow("mock IndexedDB transaction failed");
    expect(await repository.getCurrent()).toEqual(record);
  });
});
