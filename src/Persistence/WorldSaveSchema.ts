import { APP_VERSION } from "../config/version";

export const CURRENT_SAVE_SCHEMA_VERSION = 1 as const;

export interface FactionSaveV1 {
  factionId: string;
  displayName: string;
  color: number;
  factionType: string;
  status: string;
  firstFoundedMonth: number;
  currentActiveSinceMonth: number;
  lastExiledMonth?: number;
  restorationMonths: number[];
  extinctionMonth?: number;
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

export interface WorldSaveV1 {
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
  blocks: { gridX: number; gridY: number; ownerFactionId?: string; isHome: boolean; cityId?: string; [additionalCanonicalState: string]: unknown }[];
  cities: CitySaveV1[];
  users: UserSaveV1[];
  units: UnitSaveV1[];
  dynasties: Record<string, unknown>[];
  worldHistory: Record<string, unknown>;
  worldEra: Record<string, unknown>;
  factionSnapshots: Record<string, unknown>;
  worldRemnants: Record<string, unknown>[];
  worldExiles: Record<string, unknown>[];
  factionEffects: Record<string, unknown>;
  populationSystem: PopulationSystemSaveV1;
  registries: Record<string, unknown>;
  worldEventSystem: WorldEventSystemSaveV1;
}

export function createEmptyWorldSaveV1(): WorldSaveV1 {
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
  };
}

export function canonicalWorldSaveProjection(save: WorldSaveV1) {
  const { createdAt: _createdAt, ...canonical } = save;
  return canonical;
}

export function isCanonicalWorldSaveEquivalent(a: WorldSaveV1, b: WorldSaveV1) {
  return JSON.stringify(sortKeys(canonicalWorldSaveProjection(a))) === JSON.stringify(sortKeys(canonicalWorldSaveProjection(b)));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortKeys(entry)]));
  }
  return value;
}
