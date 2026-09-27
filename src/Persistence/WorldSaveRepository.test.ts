import { describe, expect, it } from "vitest";
import { createEmptyWorldSaveV1 } from "./WorldSaveSchema";
import {
  createStoredWorldSaveRecord,
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

describe("single current-save repository contract", () => {
  it("supports empty, put/get equivalence, atomic replacement, and delete", async () => {
    const repository = new MemoryRepository();
    expect(await repository.getCurrent()).toBeUndefined();
    const first = createStoredWorldSaveRecord(createEmptyWorldSaveV1(), "First", "2026-01-01T00:00:00.000Z");
    await repository.putCurrent(first);
    expect(await repository.getCurrent()).toEqual(first);
    const replacement = createStoredWorldSaveRecord(createEmptyWorldSaveV1(), "Second", "2026-01-02T00:00:00.000Z");
    await repository.putCurrent(replacement);
    expect(await repository.getCurrent()).toEqual(replacement);
    await repository.deleteCurrent();
    expect(await repository.getCurrent()).toBeUndefined();
  });

  it("propagates write failures and leaves the previous record intact", async () => {
    const repository = new MemoryRepository();
    const first = createStoredWorldSaveRecord(createEmptyWorldSaveV1(), "Keep");
    await repository.putCurrent(first);
    repository.failWrites = true;
    await expect(repository.putCurrent(createStoredWorldSaveRecord(createEmptyWorldSaveV1(), "Failed")))
      .rejects.toThrow("transaction aborted");
    expect(await repository.getCurrent()).toEqual(first);
  });

  it("rejects unsupported schema and malformed save records", () => {
    const record = createStoredWorldSaveRecord(createEmptyWorldSaveV1());
    expect(validateStoredWorldSaveRecord(record).valid).toBe(true);
    expect(validateStoredWorldSaveRecord({ ...record, saveSchemaVersion: 999 }).errors).toContain("该存档版本暂不支持");
    expect(validateStoredWorldSaveRecord({ ...record, save: [] }).valid).toBe(false);
  });
});
