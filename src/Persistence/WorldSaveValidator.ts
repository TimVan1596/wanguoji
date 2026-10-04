import { CURRENT_SAVE_SCHEMA_VERSION, WorldSaveV1 } from "./WorldSaveSchema";
import { isEraMapSnapshotV1 } from "../Simulation/EraMapSnapshot";
import { MAX_DYNASTIC_SUCCESSION_CANDIDATES } from "../Politics/DynasticCandidateRules";

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
  if (!isPlainRecord(save.worldRandom) || save.worldRandom.algorithm !== "mulberry32-v1" || typeof save.worldRandom.seed !== "string" || !save.worldRandom.seed.trim() || !Number.isInteger(save.worldRandom.state) || Number(save.worldRandom.state) < 0 || Number(save.worldRandom.state) > 0xffffffff || !Number.isSafeInteger(save.worldRandom.position) || Number(save.worldRandom.position) < 0) errors.push("worldRandom must contain a supported algorithm, seed, uint32 state, and non-negative draw position");
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
  const activeCitiesById = new Map(cities
    .filter((city) => typeof city.cityId === "string")
    .map((city) => [String(city.cityId), city]));
  (Array.isArray(save.blocks) ? save.blocks : []).forEach((block) => {
    if (!finite(block.gridX) || !finite(block.gridY)) errors.push("block grid coordinates must be finite");
    if (!finite(block.homeHitPoints)) errors.push("block.homeHitPoints must be finite");
    if (block.ownerFactionId !== undefined) requireRef(block.ownerFactionId, factionIds, "block.ownerFactionId", errors);
    if (block.cityId !== undefined) {
      const cityId = String(block.cityId);
      if (!allCityIds.has(cityId)) errors.push(`unknown block.cityId: ${cityId}`);
      const city = activeCitiesById.get(cityId);
      if (city && finite(city.defense) && finite(block.homeHitPoints) && block.homeHitPoints !== city.defense) {
        errors.push(`block.homeHitPoints must match city.defense for active city ${cityId}`);
      }
    }
  });
  dynasties.forEach((dynasty) => {
    if (dynasty.factionId !== undefined) requireRef(dynasty.factionId, factionIds, "dynasty.factionId", errors);
    if (typeof dynasty.currentRulerId === "string") requireRef(dynasty.currentRulerId, rulerIds, "dynasty.currentRulerId", errors);
    if (Array.isArray(dynasty.heirIds)) dynasty.heirIds.forEach((id: unknown) => requireRef(id, rulerIds, "dynasty.heirIds", errors));
    if (dynasty.designatedHeirId !== undefined) {
      requireRef(dynasty.designatedHeirId, rulerIds, "dynasty.designatedHeirId", errors);
      if (!Array.isArray(dynasty.heirIds) || !dynasty.heirIds.includes(dynasty.designatedHeirId)) {
        errors.push("dynasty.designatedHeirId must belong to dynasty.heirIds");
      }
      if (!Number.isFinite(dynasty.designatedSinceMonth) || Number(dynasty.designatedSinceMonth) < 0) {
        errors.push("dynasty.designatedSinceMonth must be a non-negative month");
      }
    } else if (dynasty.designatedSinceMonth !== undefined) {
      errors.push("dynasty.designatedSinceMonth requires designatedHeirId");
    }
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
  validateWorldEventSystem(save.worldEventSystem, factionIds, new Set([...cityIds, ...archivedCityIds]), errors);
  validateHydrationImportShapes(save, errors);
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

function validateWorldEventSystem(
  value: unknown,
  factionIds: Set<string>,
  knownCityIds: Set<string>,
  errors: string[]
) {
  if (!isPlainRecord(value)) {
    errors.push("worldEventSystem must be an object");
    return;
  }
  const monthFields = ["nextEventMonth", "lastRebellionCheckMonth", "lastEmpireSplitCheckMonth", "lastCityFoundCheckMonth", "lastProvisionalPressureMonth"];
  monthFields.forEach((key) => {
    if (!integer(value[key])) errors.push(`worldEventSystem.${key} must be an integer month`);
  });
  if (!integer(value.fractureUntilMonth)) errors.push("worldEventSystem.fractureUntilMonth must be an integer month");
  if (!integer(value.sequence) || value.sequence < 0) errors.push("worldEventSystem.sequence must be a non-negative integer");
  ["hegemonyEmitted", "unificationEmitted"].forEach((key) => {
    if (typeof value[key] !== "boolean") errors.push(`worldEventSystem.${key} must be boolean`);
  });
  for (const key of ["unifyingFactionId"] as const) {
    if (value[key] !== undefined) requireRef(value[key], factionIds, `worldEventSystem.${key}`, errors);
  }
  if (value.unificationMonth !== undefined && !integer(value.unificationMonth)) {
    errors.push("worldEventSystem.unificationMonth must be an integer month when present");
  }

  if (!Array.isArray(value.activeEffects)) {
    errors.push("worldEventSystem.activeEffects must be an array");
  } else {
    value.activeEffects.forEach((entry: unknown, index: number) => {
      const label = `worldEventSystem.activeEffects[${index}]`;
      if (!isPlainRecord(entry)) {
        errors.push(`${label} must be an object`);
        return;
      }
      if (typeof entry.id !== "string" || !entry.id) errors.push(`${label}.id must be a non-empty string`);
      requireRef(entry.factionId, factionIds, `${label}.factionId`, errors);
      if (entry.type !== "harvest" && entry.type !== "famine") errors.push(`${label}.type is unsupported`);
      if (!integer(entry.startMonth) || !integer(entry.endMonth)) errors.push(`${label} startMonth/endMonth must be integer months`);
      if (!isPlainRecord(entry.modifiers) || !finite(entry.modifiers.populationGrowthMultiplier)) {
        errors.push(`${label}.modifiers.populationGrowthMultiplier must be finite`);
      }
    });
  }

  if (value.hegemonyCandidate !== undefined) {
    if (!isPlainRecord(value.hegemonyCandidate)) {
      errors.push("worldEventSystem.hegemonyCandidate must be an object when present");
    } else {
      requireRef(value.hegemonyCandidate.teamName, factionIds, "worldEventSystem.hegemonyCandidate.teamName", errors);
      if (!integer(value.hegemonyCandidate.since)) errors.push("worldEventSystem.hegemonyCandidate.since must be an integer month");
    }
  }

  validateMonthRecord(value.cityFoundedMonths, "worldEventSystem.cityFoundedMonths", factionIds, errors);
  validateMonthRecord(value.cityRebellionMonths, "worldEventSystem.cityRebellionMonths", knownCityIds, errors);
  validateWorldCycleState(value.cycleState, factionIds, errors);
}

function validateMonthRecord(value: unknown, label: string, validKeys: Set<string>, errors: string[]) {
  if (!isPlainRecord(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  Object.entries(value).forEach(([key, month]) => {
    if (!validKeys.has(key)) errors.push(`${label} references unknown id: ${key}`);
    if (!integer(month)) errors.push(`${label}.${key} must be an integer month`);
  });
}

function validateWorldCycleState(value: unknown, factionIds: Set<string>, errors: string[]) {
  if (!isPlainRecord(value)) {
    errors.push("worldEventSystem.cycleState must be an object");
    return;
  }
  if (!integer(value.fragmentationStartMonth)) errors.push("worldEventSystem.cycleState.fragmentationStartMonth must be an integer month");
  const factionFields = [
    "dynasticOrderFactionId", "dynasticOrderCandidateFactionId", "hegemonicCandidateFactionId",
    "hegemonicFactionId", "consolidationLeaderCandidateFactionId", "consolidationLeaderFactionId",
  ];
  factionFields.forEach((key) => {
    if (value[key] !== undefined) requireRef(value[key], factionIds, `worldEventSystem.cycleState.${key}`, errors);
  });
  const monthFields = [
    "lastUnificationMonth", "currentUnificationStartMonth", "dynasticOrderStartMonth",
    "dynasticOrderCandidateSinceMonth", "dynasticOrderExitSinceMonth", "hegemonicCandidateSinceMonth",
    "consolidationLeaderCandidateSinceMonth",
  ];
  monthFields.forEach((key) => {
    if (value[key] !== undefined && !integer(value[key])) errors.push(`worldEventSystem.cycleState.${key} must be an integer month when present`);
  });
  ["hegemonicMomentum", "consolidationLeaderMomentum"].forEach((key) => {
    if (value[key] !== undefined && !finite(value[key])) errors.push(`worldEventSystem.cycleState.${key} must be finite when present`);
  });
}

/** Validates nested structures that importState methods map, spread, or clone after teardown. */
function validateHydrationImportShapes(save: Partial<WorldSaveV1>, errors: string[]) {
  const record = (value: unknown, label: string): Record<string, any> | undefined => {
    if (isPlainRecord(value)) return value;
    errors.push(`${label} must be an object`);
    return undefined;
  };
  const records = (value: unknown, label: string): Record<string, any>[] | undefined => {
    if (!Array.isArray(value)) {
      errors.push(`${label} must be an array`);
      return undefined;
    }
    if (value.some((entry) => !isPlainRecord(entry))) errors.push(`${label} entries must be objects`);
    return value.filter(isPlainRecord);
  };

  const worldHistory = record(save.worldHistory, "worldHistory");
  if (worldHistory) {
    records(worldHistory.events, "worldHistory.events");
    if (Array.isArray(worldHistory.emittedKeys) && worldHistory.emittedKeys.some((key: unknown) => typeof key !== "string")) errors.push("worldHistory.emittedKeys entries must be strings");
    if (Array.isArray(worldHistory.extinctFactionIds) && worldHistory.extinctFactionIds.some((id: unknown) => typeof id !== "string")) errors.push("worldHistory.extinctFactionIds entries must be strings");
    ["populationCandidate", "territoryCandidate"].forEach((key) => {
      const candidate = worldHistory[key];
      if (candidate !== undefined && (!isPlainRecord(candidate) || typeof candidate.name !== "string" || !finite(candidate.since))) errors.push(`worldHistory.${key} is malformed`);
    });
  }
  const worldEra = record(save.worldEra, "worldEra");
  if (worldEra) {
    const eras = records(worldEra.eras, "worldEra.eras");
    eras?.forEach((era, index) => {
      if (!Array.isArray(era.dominantFactionIds) || !Array.isArray(era.triggerReasonCodes)) errors.push(`worldEra.eras[${index}] faction/reason fields must be arrays`);
      if (era.formationMetrics !== undefined && !isPlainRecord(era.formationMetrics)) errors.push(`worldEra.eras[${index}].formationMetrics must be an object`);
      if (era.mapSnapshot !== undefined && !isEraMapSnapshotV1(era.mapSnapshot)) errors.push(`worldEra.eras[${index}].mapSnapshot is malformed`);
    });
    const candidateState = worldEra.candidateState;
    if (candidateState !== undefined && (!isPlainRecord(candidateState) || !isPlainRecord(candidateState.candidate) || !Array.isArray(candidateState.candidate.dominantFactionIds) || !Array.isArray(candidateState.candidate.triggerReasonCodes) || !finite(candidateState.sinceMonth))) errors.push("worldEra.candidateState is malformed");
  }
  const factionSnapshots = record(save.factionSnapshots, "factionSnapshots");
  if (factionSnapshots) {
    records(factionSnapshots.snapshots, "factionSnapshots.snapshots")?.forEach((entry, index) => {
      if (!Array.isArray(entry.snapshots) || entry.snapshots.some((snapshot: unknown) => !isPlainRecord(snapshot))) errors.push(`factionSnapshots.snapshots[${index}].snapshots must contain objects`);
    });
  }
  records(save.worldRemnants, "worldRemnants");
  records(save.worldExiles, "worldExiles")?.forEach((exile, index) => {
    if (!Array.isArray(exile.heirIds) || exile.heirIds.some((id: unknown) => typeof id !== "string")) errors.push(`worldExiles[${index}].heirIds must be an array of strings`);
  });
  const factionEffects = record(save.factionEffects, "factionEffects");
  if (factionEffects) {
    records(factionEffects.effects, "factionEffects.effects");
    records(factionEffects.strategicModifiers, "factionEffects.strategicModifiers");
  }
  save.factions?.forEach((faction, index) => {
    if (!Array.isArray(faction.sovereigntyHistory) || !Array.isArray(faction.nameHistory)) errors.push(`factions[${index}] history fields must be arrays`);
    if (faction.origin && faction.origin.foundingCityIds !== undefined && (!Array.isArray(faction.origin.foundingCityIds) || faction.origin.foundingCityIds.some((id: unknown) => typeof id !== "string"))) errors.push(`factions[${index}].origin.foundingCityIds must be an array of strings`);
  });
  save.dynasties?.forEach((dynasty, index) => {
    const rulers = Array.isArray(dynasty.rulers) ? dynasty.rulers : [];
    if (!Array.isArray(dynasty.rulers) || dynasty.rulers.some((ruler: unknown) => !isPlainRecord(ruler))) errors.push(`dynasties[${index}].rulers must be an array of objects`);
    if (!Array.isArray(dynasty.heirIds) || dynasty.heirIds.some((id: unknown) => typeof id !== "string")) errors.push(`dynasties[${index}].heirIds must be an array of strings`);
    else {
      // Keep accepting any schema-V3 pool up to the legacy global bound; the
      // live runtime reconciles it to the current identity/rank-specific cap.
      if (dynasty.heirIds.length > MAX_DYNASTIC_SUCCESSION_CANDIDATES) errors.push(`dynasties[${index}].heirIds exceeds candidate limit`);
      if (new Set(dynasty.heirIds).size !== dynasty.heirIds.length) errors.push(`dynasties[${index}].heirIds must be unique`);
      dynasty.heirIds.forEach((id) => {
        const candidate = rulers.find((ruler: unknown) => isPlainRecord(ruler) && ruler.rulerId === id);
        if (!isPlainRecord(candidate) || candidate.status !== "heir") errors.push(`dynasties[${index}].heirIds must reference heir records`);
      });
    }
    if (dynasty.designatedHeirId !== undefined) {
      if (typeof dynasty.designatedHeirId !== "string") errors.push(`dynasties[${index}].designatedHeirId must be a string`);
      if (!Array.isArray(dynasty.heirIds) || !dynasty.heirIds.includes(dynasty.designatedHeirId)) errors.push(`dynasties[${index}].designatedHeirId must belong to heirIds`);
      if (!finite(dynasty.designatedSinceMonth) || dynasty.designatedSinceMonth < 0) errors.push(`dynasties[${index}].designatedSinceMonth must be a non-negative month`);
      const designated = rulers.find((ruler: unknown) => isPlainRecord(ruler) && ruler.rulerId === dynasty.designatedHeirId);
      if (!isPlainRecord(designated) || designated.status !== "heir") errors.push(`dynasties[${index}].designatedHeirId must reference an heir record`);
    } else if (dynasty.designatedSinceMonth !== undefined) {
      errors.push(`dynasties[${index}].designatedSinceMonth requires designatedHeirId`);
    }
  });
  const registries = record(save.registries, "registries");
  if (registries) {
    const cityNames = record(registries.cityNameRegistry, "registries.cityNameRegistry");
    if (cityNames) {
      records(cityNames.reserved, "registries.cityNameRegistry.reserved");
      if (!Array.isArray(cityNames.recentDynamicNames) || cityNames.recentDynamicNames.some((name: unknown) => typeof name !== "string")) errors.push("registries.cityNameRegistry.recentDynamicNames must be an array of strings");
    }
    records(registries.archivedCities, "registries.archivedCities")?.forEach((city, index) => {
      if (!Array.isArray(city.historicalOwners) || city.historicalOwners.some((id: unknown) => typeof id !== "string")) errors.push(`registries.archivedCities[${index}].historicalOwners must be an array of strings`);
      if (!Array.isArray(city.history) || city.history.some((event: unknown) => !isPlainRecord(event))) errors.push(`registries.archivedCities[${index}].history must be an array of objects`);
    });
  }
  if (Array.isArray(save.users)) save.users.forEach((user, index) => {
    if (user.slaveUnits !== undefined && (!Array.isArray(user.slaveUnits) || user.slaveUnits.some((id: unknown) => typeof id !== "string"))) errors.push(`users[${index}].slaveUnits must be an array of unit ids`);
  });
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
function integer(value: unknown): value is number { return finite(value) && Number.isInteger(value); }
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
