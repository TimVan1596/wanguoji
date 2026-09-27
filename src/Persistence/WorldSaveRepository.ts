import { APP_VERSION } from "../config/version";
import { CURRENT_SAVE_SCHEMA_VERSION, WorldSaveV1 } from "./WorldSaveSchema";
import { validateWorldSave } from "./WorldSaveValidator";

export const CURRENT_SAVE_SLOT = "current" as const;
export const WORLD_SAVE_DATABASE = "wanguoji";
export const WORLD_SAVE_STORE = "world-saves";

export interface StoredWorldSaveRecord {
  slotId: typeof CURRENT_SAVE_SLOT;
  savedAt: string;
  appVersion: string;
  saveSchemaVersion: number;
  summary: { worldMonth: number; scenarioName?: string };
  save: WorldSaveV1;
}

export interface WorldSaveRepository {
  getCurrent(): Promise<unknown | undefined>;
  putCurrent(record: StoredWorldSaveRecord): Promise<void>;
  deleteCurrent(): Promise<void>;
}

export function validateStoredWorldSaveRecord(value: unknown): {
  valid: boolean;
  errors: string[];
  record?: StoredWorldSaveRecord;
} {
  if (!isPlainRecord(value)) return { valid: false, errors: ["存档记录格式错误"] };
  const record = value as Partial<StoredWorldSaveRecord>;
  const errors: string[] = [];
  if (record.slotId !== CURRENT_SAVE_SLOT) errors.push("存档槽位不受支持");
  if (typeof record.savedAt !== "string" || !Number.isFinite(Date.parse(record.savedAt))) errors.push("保存时间无效");
  if (typeof record.appVersion !== "string" || !record.appVersion) errors.push("存档应用版本缺失");
  if (record.saveSchemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) errors.push("该存档版本暂不支持");
  if (!isPlainRecord(record.summary) || !Number.isFinite(record.summary.worldMonth)) errors.push("存档摘要格式错误");
  const saveValidation = validateWorldSave(record.save);
  if (!saveValidation.valid) errors.push(...saveValidation.errors);
  else if (record.save.saveSchemaVersion !== record.saveSchemaVersion) errors.push("存档记录与数据的 schema 版本不一致");
  else if (record.summary?.worldMonth !== record.save.world.worldMonth) errors.push("存档摘要月份与世界数据不一致");
  return errors.length
    ? { valid: false, errors }
    : { valid: true, errors: [], record: value as StoredWorldSaveRecord };
}

export function createStoredWorldSaveRecord(
  save: WorldSaveV1,
  scenarioName?: string,
  savedAt = new Date().toISOString()
): StoredWorldSaveRecord {
  return {
    slotId: CURRENT_SAVE_SLOT,
    savedAt,
    appVersion: APP_VERSION,
    saveSchemaVersion: save.saveSchemaVersion,
    summary: { worldMonth: save.world.worldMonth, scenarioName },
    save,
  };
}

export class IndexedDbWorldSaveRepository implements WorldSaveRepository {
  constructor(private readonly factory: IDBFactory = indexedDB) {}

  async getCurrent(): Promise<unknown | undefined> {
    const db = await this.open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(WORLD_SAVE_STORE, "readonly");
        const request = tx.objectStore(WORLD_SAVE_STORE).get(CURRENT_SAVE_SLOT);
        request.onsuccess = () => resolve(request.result as unknown | undefined);
        request.onerror = () => reject(request.error ?? new Error("读取本地存档失败"));
        tx.onabort = () => reject(tx.error ?? new Error("读取本地存档事务中止"));
      });
    } finally {
      db.close();
    }
  }

  async putCurrent(record: StoredWorldSaveRecord): Promise<void> {
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(WORLD_SAVE_STORE, "readwrite");
        tx.objectStore(WORLD_SAVE_STORE).put(record, CURRENT_SAVE_SLOT);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("写入本地存档失败"));
        tx.onabort = () => reject(tx.error ?? new Error("写入本地存档事务中止"));
      });
    } finally {
      db.close();
    }
  }

  async deleteCurrent(): Promise<void> {
    const db = await this.open();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(WORLD_SAVE_STORE, "readwrite");
        tx.objectStore(WORLD_SAVE_STORE).delete(CURRENT_SAVE_SLOT);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error("删除本地存档失败"));
        tx.onabort = () => reject(tx.error ?? new Error("删除本地存档事务中止"));
      });
    } finally {
      db.close();
    }
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = this.factory.open(WORLD_SAVE_DATABASE, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(WORLD_SAVE_STORE)) {
          request.result.createObjectStore(WORLD_SAVE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("打开本地存档失败"));
      request.onblocked = () => reject(new Error("本地存档数据库升级被阻塞"));
    });
  }
}

function isPlainRecord(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
