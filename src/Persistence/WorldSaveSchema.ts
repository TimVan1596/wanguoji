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
  worldEventSystem: Record<string, unknown>;
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
    worldHistory: {}, worldEra: {}, factionSnapshots: {}, worldRemnants: [],
    worldExiles: [], factionEffects: {}, populationSystem: { counters: {}, lastGrowthMonth: 0 }, registries: {},
    worldEventSystem: {},
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
