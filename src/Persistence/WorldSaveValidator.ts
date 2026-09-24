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
    if (typeof save.world.started !== "boolean" || typeof save.world.running !== "boolean") errors.push("world started/running flags must be boolean");
    if (!isPlainRecord(save.world.clock) || !finite(save.world.clock.elapsedMs) || !finite(save.world.clock.worldMonth)) errors.push("world.clock requires finite worldMonth and elapsedMs");
    else if (save.world.clock.worldMonth !== save.world.worldMonth) errors.push("world.clock.worldMonth must match world.worldMonth");
    if (!isPlainRecord(save.world.simulationDriver) || !finite(save.world.simulationDriver.accumulatorMs)) errors.push("world.simulationDriver.accumulatorMs must be finite");
    if (!isPlainRecord(save.world.map) || !Number.isInteger(save.world.map.widthCells) || !Number.isInteger(save.world.map.heightCells) || !finite(save.world.map.blockSize)) errors.push("world.map geometry must contain integer cell dimensions and a finite blockSize");
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
  factions.forEach((faction) => ["color", "firstFoundedMonth", "currentActiveSinceMonth", "cumulativeActiveMonths", "homeGridX", "homeGridY"].forEach((key) => {
    if (!finite(faction[key])) errors.push(`factions.${key} must be finite`);
  }));
  cities.forEach((city) => ["centerGridX", "centerGridY", "foundedMonth", "defense", "maxDefense", "loyalty", "devastation", "captureCount"].forEach((key) => {
    if (!finite(city[key])) errors.push(`cities.${key} must be finite`);
  }));
  users.forEach((user) => ["loyalty", "score"].forEach((key) => {
    if (!finite(user[key])) errors.push(`users.${key} must be finite`);
  }));
  units.forEach((unit) => ["x", "y", "vx", "vy", "speed", "radius", "scale", "speedCoefficient", "sizeCoefficient"].forEach((key) => {
    if (!finite(unit[key])) errors.push(`units.${key} must be finite`);
  }));
  const rulerIds = new Set<string>();
  const duplicateRulerIds = new Set<string>();
  dynasties.forEach((dynasty) => {
    const rulers = Array.isArray(dynasty.rulers) ? dynasty.rulers : [];
    rulers.forEach((ruler: unknown) => {
      if (isPlainRecord(ruler) && typeof ruler.rulerId === "string") {
        if (rulerIds.has(ruler.rulerId)) duplicateRulerIds.add(ruler.rulerId);
        rulerIds.add(ruler.rulerId);
      }
    });
  });
  duplicateRulerIds.forEach((id) => errors.push(`duplicate rulerId: ${id}`));
  const archivedCityIds = new Set<string>();
  if (isPlainRecord(save.registries) && Array.isArray(save.registries.archivedCities)) {
    save.registries.archivedCities.forEach((city: unknown) => {
      if (isPlainRecord(city) && typeof city.id === "string") archivedCityIds.add(city.id);
    });
  }

  cities.forEach((city) => {
    requireRef(city.ownerFactionId, factionIds, "city.ownerFactionId", errors);
    requireRef(city.founderFactionId, factionIds, "city.founderFactionId", errors);
    if (city.capitalFactionId !== undefined) requireRef(city.capitalFactionId, factionIds, "city.capitalFactionId", errors);
  });
  users.forEach((user) => {
    requireRef(user.factionId, factionIds, "user.factionId", errors);
    if (user.sourceFactionId !== undefined) requireRef(user.sourceFactionId, factionIds, "user.sourceFactionId", errors);
    if (user.rulerId !== undefined) requireRef(user.rulerId, rulerIds, "user.rulerId", errors);
    if (user.playerUnitId !== undefined) requireRef(user.playerUnitId, unitIds, "user.playerUnitId", errors);
  });
  units.forEach((unit) => {
    if (unit.factionId !== undefined) requireRef(unit.factionId, factionIds, "unit.factionId", errors);
    if (unit.userId !== undefined && !userIds.has(String(unit.userId))) errors.push(`unknown unit.userId: ${unit.userId}`);
    if (unit.rulerId !== undefined) requireRef(unit.rulerId, rulerIds, "unit.rulerId", errors);
    if (unit.parentUnitId !== undefined) requireRef(unit.parentUnitId, unitIds, "unit.parentUnitId", errors);
    if (Array.isArray(unit.children)) unit.children.forEach((id: unknown) => requireRef(id, unitIds, "unit.children", errors));
  });
  const allCityIds = new Set([...cityIds, ...archivedCityIds]);
  (Array.isArray(save.blocks) ? save.blocks : []).forEach((block) => {
    if (!finite(block.gridX) || !finite(block.gridY)) errors.push("block grid coordinates must be finite");
    if (block.ownerFactionId !== undefined) requireRef(block.ownerFactionId, factionIds, "block.ownerFactionId", errors);
    if (block.cityId !== undefined && !allCityIds.has(String(block.cityId))) errors.push(`unknown block.cityId: ${String(block.cityId)}`);
  });
  dynasties.forEach((dynasty) => {
    if (dynasty.factionId !== undefined) requireRef(dynasty.factionId, factionIds, "dynasty.factionId", errors);
    if (typeof dynasty.currentRulerId === "string") requireRef(dynasty.currentRulerId, rulerIds, "dynasty.currentRulerId", errors);
    if (Array.isArray(dynasty.heirIds)) dynasty.heirIds.forEach((id: unknown) => requireRef(id, rulerIds, "dynasty.heirIds", errors));
    const rulers = Array.isArray(dynasty.rulers) ? dynasty.rulers : [];
    rulers.forEach((ruler: unknown) => {
      if (!isPlainRecord(ruler)) return;
      if (ruler.parentId !== undefined) requireRef(ruler.parentId, rulerIds, "ruler.parentId", errors);
      if (ruler.predecessorId !== undefined) requireRef(ruler.predecessorId, rulerIds, "ruler.predecessorId", errors);
    });
  });
  factions.forEach((faction) => {
    if (faction.capitalCityId !== undefined) {
      requireRef(faction.capitalCityId, cityIds, "faction.capitalCityId", errors);
      const capital = cities.find((city) => city.cityId === faction.capitalCityId);
      if (capital && (capital.ownerFactionId !== faction.factionId || capital.isCapital !== true)) {
        errors.push(`invalid capital relationship for faction ${String(faction.factionId)}`);
      }
    }
  });
  const worldEvents = isPlainRecord(save.worldHistory) && Array.isArray(save.worldHistory.events)
    ? save.worldHistory.events.filter(isPlainRecord)
    : [];
  const eventIds = new Set<string>();
  worldEvents.forEach((event: Record<string, any>) => {
    if (typeof event.id !== "string") errors.push("worldHistory event id is required");
    else if (eventIds.has(event.id)) errors.push(`duplicate worldHistory event id: ${event.id}`);
    else eventIds.add(event.id);
  });
  if (worldEvents.length) {
    worldEvents.forEach((event: Record<string, any>) => {
      if (!isPlainRecord(event)) return;
      const factionRefs = [event.actorFactionId, event.targetFactionId, event.conquerorFactionId,
        event.previousOwnerFactionId, event.founderFactionId, ...(Array.isArray(event.factionIds) ? event.factionIds : []),
        ...(Array.isArray(event.relatedFactionIds) ? event.relatedFactionIds : [])];
      factionRefs.filter((id) => id !== undefined).forEach((id) => requireRef(id, factionIds, "worldHistory faction reference", errors));
      if (event.cityId !== undefined && !allCityIds.has(String(event.cityId))) errors.push(`unknown worldHistory cityId: ${String(event.cityId)}`);
      if (event.rulerId !== undefined) requireRef(event.rulerId, rulerIds, "worldHistory rulerId", errors);
      if (event.monthIndex !== undefined && !finite(event.monthIndex)) errors.push("worldHistory event monthIndex must be finite");
    });
  }
  dynasties.forEach((dynasty) => {
    const rulers = Array.isArray(dynasty.rulers) ? dynasty.rulers : [];
    rulers.forEach((ruler: unknown) => {
      if (!isPlainRecord(ruler) || !isPlainRecord(ruler.chronicle)) return;
      const ids = ruler.chronicle.notableEventIds;
      if (Array.isArray(ids)) ids.forEach((id: unknown) => {
        if (typeof id !== "string" || !eventIds.has(id)) errors.push(`unknown notable world event id: ${String(id)}`);
      });
    });
  });
  if (!jsonSafe(value)) errors.push("save contains non-JSON-safe values or class instances");
  validatePopulationSystem(save.populationSystem, errors);
  return { valid: errors.length === 0, errors };
}

function validatePopulationSystem(value: unknown, errors: string[]) {
  if (!isPlainRecord(value)) {
    errors.push("populationSystem must be an object");
    return;
  }
  if (!isPlainRecord(value.counters)) {
    errors.push("populationSystem.counters must be an object");
  } else {
    Object.entries(value.counters).forEach(([factionId, counter]) => {
      if (!factionId || !Number.isInteger(counter) || counter < 0) {
        errors.push(`populationSystem.counters.${factionId} must be a non-negative integer`);
      }
    });
  }
  if (!Number.isInteger(value.lastGrowthMonth) || value.lastGrowthMonth < 0) {
    errors.push("populationSystem.lastGrowthMonth must be a non-negative integer");
  }
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
