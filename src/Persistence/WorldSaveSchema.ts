import type { FactionLifetimeState } from "../Simulation/FactionLifetimeRecord";
import type { Ruler } from "../Politics/Dynasty";
import { APP_VERSION } from "../config/version";
import { WORLD_RNG_ALGORITHM, WorldRandomState } from "../Simulation/WorldRandom";
import type { DiplomaticRelation, DiplomaticPairMemory } from "../Politics/Diplomacy";
import type { FactionColorHistoryEntry } from "../Simulation/FactionColorHistory";

export const CURRENT_SAVE_SCHEMA_VERSION = 13 as const;

/** V13 person DTO: endMonth closes an office; deathMonth records an actual death. */
export type RulerSaveV13 = Omit<Ruler, "id" | "bornYear" | "naturalDeathYear" | "accessionYear" |
  "plannedEndYear" | "endYear" | "politicalStartYear" | "politicalEndYear"> & {
  rulerId: string;
  bornMonth: number;
  naturalDeathMonth?: number;
  accessionMonth?: number;
  plannedEndMonth?: number;
  endMonth?: number;
  politicalStartMonth?: number;
  politicalEndMonth?: number;
};

export interface FactionSaveV1 {
  factionId: string;
  displayName: string;
  color: number;
  colorHistory: FactionColorHistoryEntry[];
  factionType: string;
  status: string;
  firstFoundedMonth: number;
  currentActiveSinceMonth: number;
  lastExiledMonth?: number;
  restorationMonths: number[];
  extinctionMonth?: number;
  terminationReason?: "EXTINCT" | "MERGED" | "SUBMITTED";
  terminationTargetFactionId?: string;
  terminationMonth?: number;
  cumulativeActiveMonths: number;
  identityStage: string;
  sovereigntyRank: string;
  sovereigntyHistory: Record<string, unknown>[];
  stateFoundedMonth?: number;
  emperorEligibleSinceMonth?: number;
  proclaimedEmperorMonth?: number;
  nameHistory: Record<string, unknown>[];
  origin: Record<string, unknown>;
  houseName?: string;
  capitalCityId?: string;
  homeGridX: number;
  homeGridY: number;
  [additionalCanonicalState: string]: unknown;
}

export interface CitySaveV1 {
  cityId: string;
  name: string;
  founderFactionId: string;
  ownerFactionId: string;
  centerGridX: number;
  centerGridY: number;
  foundedMonth: number;
  isCapital: boolean;
  defense: number;
  maxDefense: number;
  loyalty: number;
  devastation: number;
  captureCount: number;
  [additionalCanonicalState: string]: unknown;
}

export interface UserSaveV1 {
  userId: string | number;
  name: string;
  factionId: string;
  sourceFactionId: string;
  loyalty: number;
  role: string;
  score: number;
  playerUnitId: string;
  [additionalCanonicalState: string]: unknown;
}

export interface UnitSaveV1 {
  unitId: string;
  factionId: string;
  userId?: string | number;
  parentUnitId?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  radius: number;
  scale: number;
  speedCoefficient: number;
  sizeCoefficient: number;
  alive: boolean;
  role: string;
  rulerId?: string;
  [additionalCanonicalState: string]: unknown;
}

export interface PopulationSystemSaveV1 {
  counters: Record<string, number>;
  lastGrowthMonth: number;
}

export interface WorldCycleStateSaveV1 {
  fragmentationStartMonth: number;
  lastUnificationMonth?: number;
  currentUnificationStartMonth?: number;
  dynasticOrderFactionId?: string;
  dynasticOrderStartMonth?: number;
  dynasticOrderCandidateFactionId?: string;
  dynasticOrderCandidateSinceMonth?: number;
  dynasticOrderExitSinceMonth?: number;
  hegemonicCandidateFactionId?: string;
  hegemonicCandidateSinceMonth?: number;
  hegemonicFactionId?: string;
  hegemonicMomentum?: number;
  consolidationLeaderCandidateFactionId?: string;
  consolidationLeaderCandidateSinceMonth?: number;
  consolidationLeaderFactionId?: string;
  consolidationLeaderMomentum?: number;
}

export interface WorldEventEffectSaveV1 {
  id: string;
  factionId: string;
  type: "harvest" | "famine";
  startMonth: number;
  endMonth: number;
  modifiers: { populationGrowthMultiplier: number };
}

export interface WorldEventSystemSaveV1 {
  activeEffects: WorldEventEffectSaveV1[];
  nextEventMonth: number;
  sequence: number;
  hegemonyCandidate?: { teamName: string; since: number };
  hegemonyEmitted: boolean;
  unificationEmitted: boolean;
  unifyingFactionId?: string;
  unificationMonth?: number;
  fractureUntilMonth: number;
  lastRebellionCheckMonth: number;
  lastEmpireSplitCheckMonth: number;
  lastCityFoundCheckMonth: number;
  lastProvisionalPressureMonth: number;
  cityFoundedMonths: Record<string, number>;
  cityRebellionMonths: Record<string, number>;
  cycleState: WorldCycleStateSaveV1;
}

export interface WorldSaveV13 {
  saveSchemaVersion: typeof CURRENT_SAVE_SCHEMA_VERSION;
  appVersion: string;
  createdAt?: string;
  scenarioId?: string;
  world: {
    worldMonth: number;
    started: boolean;
    running: boolean;
    selectedSpeed: number;
    clock: { worldMonth: number; elapsedMs: number; running: boolean };
    simulationDriver: { accumulatorMs: number };
    map: { widthCells: number; heightCells: number; blockSize: number };
  };
  factions: FactionSaveV1[];
  // V1: city cells store the canonical projection of City.defense; standalone/home cells preserve Block.hp.
  blocks: { gridX: number; gridY: number; ownerFactionId?: string; isHome: boolean; homeHitPoints: number; cityId?: string; isCityCenter?: boolean; [additionalCanonicalState: string]: unknown }[];
  cities: CitySaveV1[];
  users: UserSaveV1[];
  units: UnitSaveV1[];
  dynasties: Record<string, unknown>[];
  worldHistory: Record<string, unknown>;
  worldEra: Record<string, unknown>;
  factionSnapshots: Record<string, unknown>;
  factionLifetime: FactionLifetimeState;
  worldRemnants: Record<string, unknown>[];
  worldExiles: Record<string, unknown>[];
  factionEffects: Record<string, unknown>;
  populationSystem: PopulationSystemSaveV1;
  registries: Record<string, unknown>;
  worldEventSystem: WorldEventSystemSaveV1;
  worldRandom: WorldRandomState;
  diplomacy: { relations: DiplomaticRelation[]; pairMemories: DiplomaticPairMemory[]; lastEvaluationMonth: number };
}

export function createEmptyWorldSaveV13(): WorldSaveV13 {
  return {
    saveSchemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    world: {
      worldMonth: 0,
      started: false,
      running: false,
      selectedSpeed: 1,
      clock: { worldMonth: 0, elapsedMs: 0, running: false },
      simulationDriver: { accumulatorMs: 0 },
      map: { widthCells: 0, heightCells: 0, blockSize: 0 },
    },
    factionLifetime: { totalWorldBlocks: 0, records: [] },
    factions: [], blocks: [], cities: [], users: [], units: [], dynasties: [],
    worldHistory: { events: [], emittedKeys: [], extinctFactionIds: [], sequence: 0, unificationCount: 0 },
    worldEra: { eras: [], sequence: 0, lastObservedMonth: -1 },
    factionSnapshots: { snapshots: [], lastSnapshotMonth: -1 }, worldRemnants: [],
    worldExiles: [], factionEffects: { effects: [], strategicModifiers: [], sequence: 0 },
    populationSystem: { counters: {}, lastGrowthMonth: 0 },
    registries: {
      factionRegistry: { sequence: 0 },
      cityNameRegistry: { reserved: [], recentDynamicNames: [] },
      logicalUnitRegistry: { nextUnitSequence: 1 },
      dynastyRegistrySequence: 0,
      archivedCities: [],
      knownFactionIds: [],
    },
    worldEventSystem: {
      activeEffects: [], nextEventMonth: 0, sequence: 0, hegemonyEmitted: false,
      unificationEmitted: false, fractureUntilMonth: -1, lastRebellionCheckMonth: 0,
      lastEmpireSplitCheckMonth: 0, lastCityFoundCheckMonth: 0,
      lastProvisionalPressureMonth: 0, cityFoundedMonths: {}, cityRebellionMonths: {},
      cycleState: { fragmentationStartMonth: 0 },
    },
    worldRandom: { algorithm: WORLD_RNG_ALGORITHM, seed: "test-seed", state: 0, position: 0 },
    diplomacy: { relations: [], pairMemories: [], lastEvaluationMonth: -1 },
  };
}

export type WorldSaveV8 = WorldSaveV13;
export const createEmptyWorldSaveV8 = createEmptyWorldSaveV13;

/** Internal call-site aliases; persisted saves still identify their exact schema number. */
export type WorldSaveV7 = WorldSaveV13;
export type WorldSaveV6 = WorldSaveV13;
export type WorldSaveV5 = WorldSaveV13;
export type WorldSaveV4 = WorldSaveV13;
export type WorldSaveV3 = WorldSaveV13;
export type WorldSaveV2 = WorldSaveV13;
export type WorldSaveV1 = WorldSaveV13;
export const createEmptyWorldSaveV7 = createEmptyWorldSaveV13;
export const createEmptyWorldSaveV6 = createEmptyWorldSaveV13;
export const createEmptyWorldSaveV5 = createEmptyWorldSaveV13;
export const createEmptyWorldSaveV4 = createEmptyWorldSaveV13;
export const createEmptyWorldSaveV3 = createEmptyWorldSaveV13;
export const createEmptyWorldSaveV2 = createEmptyWorldSaveV13;
export const createEmptyWorldSaveV1 = createEmptyWorldSaveV13;

export function canonicalWorldSaveProjection(save: WorldSaveV1) {
  const { createdAt: _createdAt, ...canonical } = save;
  return canonical;
}

export function isCanonicalWorldSaveEquivalent(a: WorldSaveV1, b: WorldSaveV1) {
  return diffCanonicalWorldSave(a, b).matched;
}

export interface CanonicalWorldSaveDifference {
  path: string;
  before: unknown;
  after: unknown;
}

export interface CanonicalWorldSaveDiff {
  matched: boolean;
  differenceCount: number;
  differences: CanonicalWorldSaveDifference[];
  subsystemCounts: Record<string, number>;
}

const CANONICAL_SUBSYSTEMS = [
  "world", "factions", "blocks", "cities", "users", "units", "dynasties",
  "worldHistory", "worldEra", "factionLifetime", "factionSnapshots", "worldRemnants", "worldExiles",
  "factionEffects", "populationSystem", "registries", "worldEventSystem", "diplomacy", "metadata",
] as const;

/** Debug-oriented structural comparison. Object key order is ignored; array order remains canonical. */
export function diffCanonicalWorldSave(a: WorldSaveV1, b: WorldSaveV1, limit = 25): CanonicalWorldSaveDiff {
  const before = canonicalWorldSaveProjection(a) as unknown as Record<string, unknown>;
  const after = canonicalWorldSaveProjection(b) as unknown as Record<string, unknown>;
  const subsystemCounts = Object.fromEntries(CANONICAL_SUBSYSTEMS.map((key) => [key, 0]));
  const differences: CanonicalWorldSaveDifference[] = [];
  let differenceCount = 0;
  const record = (path: string, left: unknown, right: unknown) => {
    differenceCount += 1;
    const subsystem = path.split(/[.[]/, 1)[0];
    subsystemCounts[subsystem in subsystemCounts ? subsystem : "metadata"] += 1;
    if (differences.length < Math.max(0, limit)) {
      differences.push({ path, before: simplifyDiffValue(left), after: simplifyDiffValue(right) });
    }
  };
  const visit = (left: unknown, right: unknown, path: string): void => {
    if (Object.is(left, right)) return;
    const leftArray = Array.isArray(left);
    const rightArray = Array.isArray(right);
    if (leftArray || rightArray) {
      if (!leftArray || !rightArray) return record(path, left, right);
      for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
        visit(left[index], right[index], `${path}[${index}]`);
      }
      return;
    }
    const leftObject = isPlainRecord(left);
    const rightObject = isPlainRecord(right);
    if (leftObject || rightObject) {
      if (!leftObject || !rightObject) return record(path, left, right);
      [...new Set([...Object.keys(left), ...Object.keys(right)])].sort().forEach((key) => {
        visit(left[key], right[key], path ? `${path}.${key}` : key);
      });
      return;
    }
    record(path, left, right);
  };
  visit(before, after, "");
  return { matched: differenceCount === 0, differenceCount, differences, subsystemCounts };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function simplifyDiffValue(value: unknown): unknown {
  if (value === undefined) return "<missing>";
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return `[Array(${value.length})]`;
  if (isPlainRecord(value)) return `{Object(${Object.keys(value).length} keys)}`;
  return String(value);
}

// Legacy source API aliases only; every emitted/accepted DTO is schema V13.
export type WorldSaveV9 = WorldSaveV13;
export const createEmptyWorldSaveV9 = createEmptyWorldSaveV13;

// Source aliases only, not compatibility: schema 10 is rejected.
export type WorldSaveV10 = WorldSaveV13;
export const createEmptyWorldSaveV10 = createEmptyWorldSaveV13;

// Source aliases do not accept old persisted schemas.
export type WorldSaveV11 = WorldSaveV13;
export const createEmptyWorldSaveV11 = createEmptyWorldSaveV13;

// Source aliases only, not support for loading version 12 saves.
export type WorldSaveV12 = WorldSaveV13;
export const createEmptyWorldSaveV12 = createEmptyWorldSaveV13;
