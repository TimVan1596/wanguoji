import { normalizeArchivedCityBlockRefs } from "./ArchivedCityHydrationRepair";
import { APP_VERSION } from "../config/version";
import { CURRENT_SAVE_SCHEMA_VERSION, WorldSaveV1 } from "./WorldSaveSchema";
import { validateWorldSave } from "./WorldSaveValidator";

export const CURRENT_SAVE_SLOT = "current" as const;
export const AUTOSAVE_SLOT_IDS = ["autosave-1", "autosave-2"] as const;
export const WORLD_SAVE_DATABASE = "wanguoji";
export const WORLD_SAVE_DATABASE_VERSION = 2;
export const WORLD_SAVE_STORE = "world-saves";
export const WORLD_SAVE_INDEX_STORE = "world-save-index";

export type SaveSlotType = "RECOVERY" | "AUTOSAVE" | "MANUAL";

export interface SaveSlotMetadata {
  slotId: string;
  slotType: SaveSlotType;
  displayName?: string;
  savedAt: string;
  worldMonth: number;
  scenarioName?: string;
  currentEraName?: string;
  activeFactionCount?: number;
  worldYearLabel?: string;
  appVersion: string;
  saveSchemaVersion: number;
}

export interface StoredWorldSaveRecord {
  slotId: string;
  slotType?: SaveSlotType;
  displayName?: string;
  savedAt: string;
  appVersion: string;
  saveSchemaVersion: number;
  summary: {
    worldMonth: number;
    scenarioName?: string;
    currentEraName?: string;
    activeFactionCount?: number;
    worldYearLabel?: string;
  };
  save: WorldSaveV1;
}

export interface WorldSaveRepository {
  get(slotId: string): Promise<unknown | undefined>;
  put(slotId: string, record: StoredWorldSaveRecord): Promise<void>;
  delete(slotId: string): Promise<void>;
  listMetadata(): Promise<SaveSlotMetadata[]>;
  getCurrent(): Promise<unknown | undefined>;
  putCurrent(record: StoredWorldSaveRecord): Promise<void>;
  deleteCurrent(): Promise<void>;
}

export function inferSaveSlotType(slotId: string, explicit?: unknown): SaveSlotType | undefined {
  const inferred: SaveSlotType | undefined = slotId === CURRENT_SAVE_SLOT
    ? "RECOVERY"
    : (AUTOSAVE_SLOT_IDS as readonly string[]).includes(slotId)
      ? "AUTOSAVE"
      : slotId.startsWith("manual-") ? "MANUAL" : undefined;
  if (!inferred) return undefined;
  if (explicit !== undefined && explicit !== inferred) return undefined;
  return inferred;
}

export function createManualSaveSlotId(uuid = createUuid()) {
  return `manual-${uuid}`;
}

export function createStoredWorldSaveRecord(
  save: WorldSaveV1,
  scenarioName?: string,
  savedAt = new Date().toISOString(),
  options: { slotId?: string; slotType?: SaveSlotType; displayName?: string } = {}
): StoredWorldSaveRecord {
  const slotId = options.slotId ?? (options.slotType === "MANUAL" ? createManualSaveSlotId() : CURRENT_SAVE_SLOT);
  const slotType = options.slotType ?? inferSaveSlotType(slotId) ?? "RECOVERY";
  const activeEra = getActiveEraName(save.worldEra);
  const worldMonth = save.world.worldMonth;
  return {
    slotId,
    slotType,
    ...(options.displayName ? { displayName: options.displayName } : {}),
    savedAt,
    appVersion: APP_VERSION,
    saveSchemaVersion: save.saveSchemaVersion,
    summary: {
      worldMonth,
      ...(scenarioName ? { scenarioName } : {}),
      ...(activeEra ? { currentEraName: activeEra } : {}),
      activeFactionCount: save.factions.filter((faction) => faction.status === "ACTIVE").length,
      worldYearLabel: `${Math.floor(worldMonth / 12)}年`,
    },
    save,
  };
}

export function toSaveSlotMetadata(value: unknown, key?: string): SaveSlotMetadata | undefined {
  if (!isPlainRecord(value)) return undefined;
  const record = value as Partial<StoredWorldSaveRecord>;
  const slotId = typeof record.slotId === "string" ? record.slotId : key;
  if (!slotId || !isPlainRecord(record.summary)) return undefined;
  const slotType = inferSaveSlotType(slotId, record.slotType);
  const worldMonth = record.summary.worldMonth;
  if (!slotType || typeof record.savedAt !== "string" || !Number.isFinite(worldMonth)) return undefined;
  return {
    slotId,
    slotType,
    ...(typeof record.displayName === "string" ? { displayName: record.displayName } : {}),
    savedAt: record.savedAt,
    worldMonth: worldMonth as number,
    ...(typeof record.summary.scenarioName === "string" ? { scenarioName: record.summary.scenarioName } : {}),
    ...(typeof record.summary.currentEraName === "string" ? { currentEraName: record.summary.currentEraName } : {}),
    ...(Number.isInteger(record.summary.activeFactionCount) ? { activeFactionCount: record.summary.activeFactionCount as number } : {}),
    ...(typeof record.summary.worldYearLabel === "string" ? { worldYearLabel: record.summary.worldYearLabel } : {}),
    appVersion: typeof record.appVersion === "string" ? record.appVersion : "unknown",
    saveSchemaVersion: typeof record.saveSchemaVersion === "number" ? record.saveSchemaVersion : 0,
  };
}

export function validateStoredWorldSaveRecord(value: unknown, expectedSlotId?: string): {
  valid: boolean;
  errors: string[];
  record?: StoredWorldSaveRecord;
} {
  if (!isPlainRecord(value)) return { valid: false, errors: ["存档记录格式错误"] };
  const record = value as Partial<StoredWorldSaveRecord>;
  const saveValue = record.save;
  if (record.saveSchemaVersion === 12 || (saveValue as { saveSchemaVersion?: unknown } | undefined)?.saveSchemaVersion === 12) {
    return { valid: false, errors: ["此存档为旧版V12，当前V13不支持读取，请新建世界。"] };
  }
  const errors: string[] = [];
  if (expectedSlotId !== undefined && record.slotId !== expectedSlotId) errors.push("存档记录与索引槽位不一致");
  const slotType = typeof record.slotId === "string" ? inferSaveSlotType(record.slotId, record.slotType) : undefined;
  if (!slotType) errors.push("存档槽位不受支持");
  if (record.slotType !== undefined && record.slotType !== slotType) errors.push("存档槽位类型与 ID 不一致");
  if (typeof record.savedAt !== "string" || !Number.isFinite(Date.parse(record.savedAt))) errors.push("保存时间无效");
  if (typeof record.appVersion !== "string" || !record.appVersion) errors.push("存档应用版本缺失");
  if (record.saveSchemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) errors.push("该存档版本暂不支持");
  if (!isPlainRecord(record.summary) || !Number.isInteger(record.summary.worldMonth) || record.summary.worldMonth < 0) errors.push("存档摘要格式错误");
  else {
    if (record.summary.scenarioName !== undefined && typeof record.summary.scenarioName !== "string") errors.push("存档摘要情景名称无效");
    if (record.summary.currentEraName !== undefined && typeof record.summary.currentEraName !== "string") errors.push("存档摘要时代名称无效");
    if (record.summary.activeFactionCount !== undefined && (!Number.isInteger(record.summary.activeFactionCount) || record.summary.activeFactionCount < 0)) errors.push("存档摘要势力数量无效");
    if (record.summary.worldYearLabel !== undefined && typeof record.summary.worldYearLabel !== "string") errors.push("存档摘要年代无效");
  }
  if (record.displayName !== undefined && typeof record.displayName !== "string") errors.push("存档名称无效");
  const saveValidation = validateWorldSave(normalizeArchivedCityBlockRefs(saveValue).value);
  if (!saveValidation.valid) saveValidation.errors.forEach((error) => errors.push(error));
  else if (!(saveValue as WorldSaveV1).world.started) errors.push("存档尚未开始，不能继续");
  else if ((saveValue as WorldSaveV1).saveSchemaVersion !== record.saveSchemaVersion) errors.push("存档记录与数据的 schema 版本不一致");
  else if ((record.summary as StoredWorldSaveRecord["summary"])?.worldMonth !== (saveValue as WorldSaveV1).world.worldMonth) errors.push("存档摘要月份与世界数据不一致");
  if (errors.length) return { valid: false, errors };
  return {
    valid: true,
    errors: [],
    record: { ...record, slotType } as StoredWorldSaveRecord,
  };
}

export class IndexedDbWorldSaveRepository implements WorldSaveRepository {
  constructor(private readonly factory?: IDBFactory) {}

  async get(slotId: string): Promise<unknown | undefined> {
    return this.withDatabase((db) => requestValue(db.transaction(WORLD_SAVE_STORE, "readonly").objectStore(WORLD_SAVE_STORE).get(slotId)));
  }

  async put(slotId: string, record: StoredWorldSaveRecord): Promise<void> {
    if (record.slotId !== slotId) throw new Error("存档记录 slotId 与写入目标不一致");
    const metadata = toSaveSlotMetadata(record);
    if (!metadata) throw new Error("无法生成存档列表摘要");
    await this.withDatabase((db) => transactionDone(db, [WORLD_SAVE_STORE, WORLD_SAVE_INDEX_STORE], (tx) => {
      tx.objectStore(WORLD_SAVE_STORE).put(record, slotId);
      tx.objectStore(WORLD_SAVE_INDEX_STORE).put(metadata, slotId);
    }));
  }

  async delete(slotId: string): Promise<void> {
    await this.withDatabase((db) => transactionDone(db, [WORLD_SAVE_STORE, WORLD_SAVE_INDEX_STORE], (tx) => {
      tx.objectStore(WORLD_SAVE_STORE).delete(slotId);
      tx.objectStore(WORLD_SAVE_INDEX_STORE).delete(slotId);
    }));
  }

  async listMetadata(): Promise<SaveSlotMetadata[]> {
    return this.withDatabase(async (db) => {
      const values = await requestValue<unknown[]>(db.transaction(WORLD_SAVE_INDEX_STORE, "readonly").objectStore(WORLD_SAVE_INDEX_STORE).getAll());
      return values.flatMap((value) => {
        const metadata = normalizeIndexedMetadata(value);
        return metadata ? [metadata] : [];
      }).sort((a, b) => b.savedAt.localeCompare(a.savedAt) || a.slotId.localeCompare(b.slotId));
    });
  }

  getCurrent() { return this.get(CURRENT_SAVE_SLOT); }
  putCurrent(record: StoredWorldSaveRecord) { return this.put(CURRENT_SAVE_SLOT, { ...record, slotId: CURRENT_SAVE_SLOT, slotType: "RECOVERY" }); }
  deleteCurrent() { return this.delete(CURRENT_SAVE_SLOT); }

  private async withDatabase<T>(operation: (db: IDBDatabase) => Promise<T>): Promise<T> {
    const db = await this.open();
    try { return await operation(db); } finally { db.close(); }
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const factory = this.factory ?? globalThis.indexedDB;
      if (!factory) { reject(new Error("当前浏览器不支持 IndexedDB")); return; }
      const request = factory.open(WORLD_SAVE_DATABASE, WORLD_SAVE_DATABASE_VERSION);
      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WORLD_SAVE_STORE)) db.createObjectStore(WORLD_SAVE_STORE);
        const transaction = request.transaction;
        if (!db.objectStoreNames.contains(WORLD_SAVE_INDEX_STORE)) {
          db.createObjectStore(WORLD_SAVE_INDEX_STORE);
          const sourceVersion = (event as IDBVersionChangeEvent).oldVersion;
          if (sourceVersion < 2 && transaction) {
            const cursorRequest = transaction.objectStore(WORLD_SAVE_STORE).openCursor();
            cursorRequest.onsuccess = () => {
              const cursor = cursorRequest.result;
              if (!cursor) return;
              const metadata = toSaveSlotMetadata(cursor.value, String(cursor.primaryKey));
              if (metadata) transaction.objectStore(WORLD_SAVE_INDEX_STORE).put(metadata, metadata.slotId);
              cursor.continue();
            };
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("打开本地存档失败"));
      request.onblocked = () => reject(new Error("本地存档数据库升级被阻塞"));
    });
  }
}

function normalizeIndexedMetadata(value: unknown): SaveSlotMetadata | undefined {
  if (!isPlainRecord(value) || typeof value.slotId !== "string") return undefined;
  const slotType = inferSaveSlotType(value.slotId, value.slotType);
  if (!slotType || typeof value.savedAt !== "string" || typeof value.worldMonth !== "number") return undefined;
  return { ...value, slotType } as SaveSlotMetadata;
}

function requestValue<T = unknown>(request: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error ?? new Error("读取本地存档失败"));
  });
}

function transactionDone<T>(db: IDBDatabase, stores: string[], work: (tx: IDBTransaction) => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, "readwrite");
    let result: T;
    try { result = work(tx); } catch (error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error ?? new Error("写入本地存档失败"));
    tx.onabort = () => reject(tx.error ?? new Error("本地存档事务中止"));
  });
}

function getActiveEraName(worldEra: Record<string, unknown>) {
  const eras = worldEra.eras;
  if (!Array.isArray(eras)) return undefined;
  const active = [...eras].reverse().find((era) => isPlainRecord(era) && era.endMonth === undefined);
  return isPlainRecord(active) && typeof active.name === "string" ? active.name : undefined;
}

function createUuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((byte, index) => `${index === 4 || index === 6 || index === 8 || index === 10 ? "-" : ""}${byte.toString(16).padStart(2, "0")}`).join("");
}

function isPlainRecord(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
