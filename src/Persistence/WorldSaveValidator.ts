import { CURRENT_SAVE_SCHEMA_VERSION, WorldSaveV1 } from "./WorldSaveSchema";

export interface SaveValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateWorldSave(value: unknown): SaveValidationResult {
  const errors: string[] = [];
  if (!isPlainRecord(value)) return { valid: false, errors: ["save must be a plain object"] };
  const save = value as Partial<WorldSaveV1>;
  if (save.saveSchemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) errors.push("unsupported saveSchemaVersion");
  if (typeof save.appVersion !== "string" || !save.appVersion.trim()) errors.push("appVersion is required");
  if (!isPlainRecord(save.world)) errors.push("world must be an object");
  else {
    if (!finite(save.world.worldMonth) || save.world.worldMonth < 0) errors.push("world.worldMonth must be a non-negative finite month index");
    if (!finite(save.world.selectedSpeed)) errors.push("world.selectedSpeed must be finite");
    if (!isPlainRecord(save.world.clock) || !finite(save.world.clock.elapsedMs)) errors.push("world.clock.elapsedMs must be finite");
    if (!isPlainRecord(save.world.simulationDriver) || !finite(save.world.simulationDriver.accumulatorMs)) errors.push("world.simulationDriver.accumulatorMs must be finite");
  }

  const factions = array(save.factions, "factions", errors);
  const cities = array(save.cities, "cities", errors);
  const users = array(save.users, "users", errors);
  const units = array(save.units, "units", errors);
  const dynasties = array(save.dynasties, "dynasties", errors);
  const factionIds = uniqueIds(factions, "factionId", "factions", errors);
  const cityIds = uniqueIds(cities, "cityId", "cities", errors);
  const userIds = uniqueIds(users, "userId", "users", errors);
  const unitIds = uniqueIds(units, "unitId", "units", errors);
  const rulerIds = new Set<string>();
  dynasties.forEach((dynasty) => {
    const rulers = Array.isArray(dynasty.rulers) ? dynasty.rulers : [];
    rulers.forEach((ruler: unknown) => {
      if (isPlainRecord(ruler) && typeof ruler.rulerId === "string") rulerIds.add(ruler.rulerId);
    });
  });

  cities.forEach((city) => {
    requireRef(city.ownerFactionId, factionIds, "city.ownerFactionId", errors);
    requireRef(city.founderFactionId, factionIds, "city.founderFactionId", errors);
    if (city.capitalFactionId !== undefined) requireRef(city.capitalFactionId, factionIds, "city.capitalFactionId", errors);
  });
  users.forEach((user) => requireRef(user.factionId, factionIds, "user.factionId", errors));
  units.forEach((unit) => {
    if (unit.factionId !== undefined) requireRef(unit.factionId, factionIds, "unit.factionId", errors);
    if (unit.userId !== undefined && !userIds.has(String(unit.userId))) errors.push(`unknown unit.userId: ${unit.userId}`);
    if (unit.rulerId !== undefined) requireRef(unit.rulerId, rulerIds, "unit.rulerId", errors);
  });
  (Array.isArray(save.blocks) ? save.blocks : []).forEach((block) => {
    if (block.ownerFactionId !== undefined) requireRef(block.ownerFactionId, factionIds, "block.ownerFactionId", errors);
    if (block.cityId !== undefined) requireRef(block.cityId, cityIds, "block.cityId", errors);
  });
  if (!jsonSafe(value)) errors.push("save contains non-JSON-safe values or class instances");
  return { valid: errors.length === 0, errors };
}

function array(value: unknown, label: string, errors: string[]): Record<string, any>[] {
  if (!Array.isArray(value)) { errors.push(`${label} must be an array`); return []; }
  if (value.some((entry) => !isPlainRecord(entry))) errors.push(`${label} entries must be plain objects`);
  return value.filter(isPlainRecord);
}
function uniqueIds(entries: Record<string, any>[], key: string, label: string, errors: string[]) {
  const ids = new Set<string>();
  entries.forEach((entry) => {
    const id = entry[key];
    if (typeof id !== "string" && typeof id !== "number") errors.push(`${label}.${key} is required`);
    else if (ids.has(String(id))) errors.push(`duplicate ${label}.${key}: ${id}`);
    else ids.add(String(id));
  });
  return ids;
}
function requireRef(value: unknown, refs: Set<string>, label: string, errors: string[]) {
  if (typeof value !== "string" || !refs.has(value)) errors.push(`unknown ${label}: ${String(value)}`);
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function isPlainRecord(value: unknown): value is Record<string, any> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function jsonSafe(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return typeof value !== "number" || Number.isFinite(value);
  if (typeof value !== "object" || seen.has(value as object)) return false;
  if (!Array.isArray(value) && !isPlainRecord(value)) return false;
  seen.add(value as object);
  const safe = (Array.isArray(value) ? value : Object.values(value as object)).every((entry) => jsonSafe(entry, seen));
  seen.delete(value as object);
  return safe;
}
