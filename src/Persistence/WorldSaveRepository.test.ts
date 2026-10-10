import { describe, expect, it } from "vitest";
import { createEmptyWorldSaveV1 } from "./WorldSaveSchema";
import {
  createStoredWorldSaveRecord,
  createManualSaveSlotId,
  WORLD_SAVE_DATABASE_VERSION,
  WORLD_SAVE_INDEX_STORE,
  IndexedDbWorldSaveRepository,
  StoredWorldSaveRecord,
  validateStoredWorldSaveRecord,
  WorldSaveRepository,
} from "./WorldSaveRepository";

class MemoryRepository implements WorldSaveRepository {
  private value: unknown;
  private values = new Map<string, unknown>();
  failWrites = false;
  async get(slotId: string) { return slotId === "current" ? this.value : this.values.get(slotId); }
  async put(slotId: string, record: StoredWorldSaveRecord) {
    if (this.failWrites) throw new Error("transaction aborted");
    if (slotId === "current") this.value = structuredClone(record);
    else this.values.set(slotId, structuredClone(record));
  }
  async delete(slotId: string) { if (slotId === "current") this.value = undefined; else this.values.delete(slotId); }
  async listMetadata() {
    return [this.value, ...this.values.values()].filter(Boolean).map((value) => {
      const record = value as StoredWorldSaveRecord;
      return {
        slotId: record.slotId, slotType: record.slotType ?? "RECOVERY" as const, displayName: record.displayName,
        savedAt: record.savedAt, worldMonth: record.summary.worldMonth, scenarioName: record.summary.scenarioName,
        appVersion: record.appVersion, saveSchemaVersion: record.saveSchemaVersion,
      };
    });
  }
  async getCurrent() { return this.value; }
  async putCurrent(record: StoredWorldSaveRecord) {
    if (this.failWrites) throw new Error("transaction aborted");
    await this.put("current", record);
  }
  async deleteCurrent() { await this.delete("current"); }
}

function startedSave() {
  const save = createEmptyWorldSaveV1();
  save.world.started = true;
  return save;
}

function fakeIndexedDb(initialVersion = 0, initialRecords: Array<[string, unknown]> = []) {
  const stores = new Map<string, Map<IDBValidKey, unknown>>();
  stores.set("world-saves", new Map(initialRecords));
  let databaseVersion = initialVersion;
  let failWrite = false;
  const db: any = {
    get objectStoreNames() { return { contains: (name: string) => stores.has(name) }; },
    createObjectStore: (name: string) => { stores.set(name, new Map()); return {}; },
    close: () => undefined,
    transaction: (_names: string | string[]) => {
      const tx: any = { error: new Error("mock IndexedDB transaction failed") };
      tx.objectStore = (name: string) => {
        const values = stores.get(name)!;
        return {
        get: (key: IDBValidKey) => {
          const request: any = { result: values.get(key), error: undefined };
          queueMicrotask(() => request.onsuccess?.({ target: request }));
          return request;
        },
        getAll: () => {
          const request: any = { result: [...values.values()], error: undefined };
          queueMicrotask(() => request.onsuccess?.({ target: request }));
          return request;
        },
        put: (value: unknown, key: IDBValidKey) => {
          if (failWrite) queueMicrotask(() => tx.onerror?.({ target: tx }));
          else values.set(key, structuredClone(value));
          return 1;
        },
        delete: (key: IDBValidKey) => {
          values.delete(key);
          return 1;
        },
        openCursor: () => {
          const entries = [...values.entries()];
          let index = 0;
          const request: any = { result: undefined };
          const next = () => queueMicrotask(() => {
            if (index >= entries.length) request.result = null;
            else {
              const [primaryKey, value] = entries[index];
              request.result = { primaryKey, value, continue: () => { index += 1; next(); } };
            }
            request.onsuccess?.({ target: request });
          });
          next();
          return request;
        },
      };
      };
      setTimeout(() => tx.oncomplete?.({ target: tx }), 0);
      return tx;
    },
  };
  const factory = {
    open: (_name: string, version: number) => {
      const request: any = { result: db, error: undefined };
      queueMicrotask(() => {
        if (version > databaseVersion) {
          const oldVersion = databaseVersion;
          databaseVersion = version;
          request.transaction = db.transaction(["world-saves"], "versionchange");
          request.onupgradeneeded?.({ oldVersion, newVersion: version, target: request });
        }
        queueMicrotask(() => request.onsuccess?.({ target: request }));
      });
      return request;
    },
  };
  return { factory: factory as unknown as IDBFactory, stores, get version() { return databaseVersion; }, failWrite: (value: boolean) => { failWrite = value; } };
}

describe("multi-slot save repository", () => {
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

  it("preserves a legacy v1 current record and indexes it as Recovery during v2 upgrade", async () => {
    const legacySave = startedSave();
    const legacyRecord = { ...createStoredWorldSaveRecord(legacySave), slotType: undefined };
    const indexed = fakeIndexedDb(1, [["current", legacyRecord]]);
    const repository = new IndexedDbWorldSaveRepository(indexed.factory);
    expect(WORLD_SAVE_DATABASE_VERSION).toBe(2);
    const current = await repository.getCurrent();
    expect(current).toEqual(legacyRecord);
    expect(await repository.listMetadata()).toEqual([expect.objectContaining({ slotId: "current", slotType: "RECOVERY" })]);
    expect(indexed.stores.get("world-saves")?.get("current")).toEqual(legacyRecord);
    expect(indexed.stores.has(WORLD_SAVE_INDEX_STORE)).toBe(true);
  });

  it("creates UUID-based manual IDs and validates legacy type inference", () => {
    const id = createManualSaveSlotId("f2e1b4c0-test");
    expect(id).toBe("manual-f2e1b4c0-test");
    const legacy = createStoredWorldSaveRecord(startedSave());
    delete legacy.slotType;
    expect(validateStoredWorldSaveRecord(legacy).record?.slotType).toBe("RECOVERY");
    expect(validateStoredWorldSaveRecord({ ...legacy, slotId: "manual-x", slotType: "RECOVERY" }).valid).toBe(false);
  });

  it("supports manual create, rename, delete, and metadata-only listing", async () => {
    const repository = new MemoryRepository();
    const record = createStoredWorldSaveRecord(startedSave(), "Scenario", "2026-01-01T00:00:00.000Z", {
      slotId: "manual-uuid-a", slotType: "MANUAL", displayName: "档案A",
    });
    await repository.put(record.slotId, record);
    expect(await repository.listMetadata()).toEqual([expect.objectContaining({ slotId: record.slotId, displayName: "档案A", slotType: "MANUAL" })]);
    const renamed = { ...record, displayName: "档案B" };
    await repository.put(record.slotId, renamed);
    expect(await repository.get(record.slotId)).toEqual(renamed);
    await repository.delete(record.slotId);
    expect(await repository.get(record.slotId)).toBeUndefined();
    expect(await repository.listMetadata()).toEqual([]);
  });
});

it("rejects old V12 records with one explicit message without transforming stored data", () => {
  const record = createStoredWorldSaveRecord(startedSave());
  record.saveSchemaVersion = 12; (record.save as any).saveSchemaVersion = 12;
  const original = JSON.stringify(record);
  expect(validateStoredWorldSaveRecord(record)).toEqual({ valid: false, errors: ["此存档为旧版V12，当前V13不支持读取，请新建世界。"] });
  expect(JSON.stringify(record)).toBe(original); expect(WORLD_SAVE_DATABASE_VERSION).toBe(2);
});
