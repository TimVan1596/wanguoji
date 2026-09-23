import { APP_VERSION } from "../config/version";

export const CURRENT_SAVE_SCHEMA_VERSION = 1 as const;

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
    clock: { elapsedMs: number; running: boolean };
    simulationDriver: { accumulatorMs: number };
    map: { widthCells: number; heightCells: number; blockSize: number };
  };
  factions: Record<string, unknown>[];
  blocks: { gridX: number; gridY: number; ownerFactionId?: string; isHome: boolean; cityId?: string }[];
  cities: Record<string, unknown>[];
  users: Record<string, unknown>[];
  units: Record<string, unknown>[];
  dynasties: Record<string, unknown>[];
  worldHistory: Record<string, unknown>;
  worldEra: Record<string, unknown>;
  factionSnapshots: Record<string, unknown>;
  worldRemnants: Record<string, unknown>[];
  worldExiles: Record<string, unknown>[];
  factionEffects: Record<string, unknown>;
  populationSystem: Record<string, unknown>;
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
      clock: { elapsedMs: 0, running: false },
      simulationDriver: { accumulatorMs: 0 },
      map: { widthCells: 0, heightCells: 0, blockSize: 0 },
    },
    factions: [], blocks: [], cities: [], users: [], units: [], dynasties: [],
    worldHistory: {}, worldEra: {}, factionSnapshots: {}, worldRemnants: [],
    worldExiles: [], factionEffects: {}, populationSystem: {}, registries: {},
    worldEventSystem: {},
  };
}
