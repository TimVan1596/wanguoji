import type { WorldRandomState } from "./WorldRandom";

export interface DeterminismFactionProjection {
  factionId: string;
  status: string;
  population: number;
  rulerId?: string;
}

export interface DeterminismCityProjection {
  cityId: string;
  ownerFactionId?: string;
}

export interface DeterminismTerritoryProjection {
  factionId: string;
  cells: number;
}

export interface DeterminismCheckpoint {
  worldMonth: number;
  digest: string;
  seed: string;
  rngAlgorithm: string;
  rngPosition: number;
}

export interface DeterminismFingerprintInput {
  worldMonth: number;
  random: WorldRandomState;
  factions: DeterminismFactionProjection[];
  cities: DeterminismCityProjection[];
  territory: DeterminismTerritoryProjection[];
}

function stableHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function compareIds(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function createDeterminismCheckpoint(input: DeterminismFingerprintInput): DeterminismCheckpoint {
  const projection = {
    worldMonth: input.worldMonth,
    random: input.random,
    factions: [...input.factions]
      .map((faction) => ({ ...faction }))
      .sort((a, b) => compareIds(a.factionId, b.factionId)),
    cities: [...input.cities]
      .map((city) => ({ ...city }))
      .sort((a, b) => compareIds(a.cityId, b.cityId)),
    territory: [...input.territory]
      .map((entry) => ({ ...entry }))
      .sort((a, b) => compareIds(a.factionId, b.factionId)),
  };
  return {
    worldMonth: input.worldMonth,
    digest: stableHash(JSON.stringify(projection)),
    seed: input.random.seed,
    rngAlgorithm: input.random.algorithm,
    rngPosition: input.random.position,
  };
}

export class DeterminismCheckpointHistory {
  private checkpoints: DeterminismCheckpoint[] = [];
  private lastCheckpointMonth = 0;

  constructor(private readonly capacity = 12, private readonly intervalMonths = 120) {}

  resetAt(worldMonth = 0) {
    this.checkpoints = [];
    this.lastCheckpointMonth = Math.floor(Math.max(0, worldMonth) / this.intervalMonths) * this.intervalMonths;
  }

  isDue(worldMonth: number) {
    return this.capacity > 0 &&
      worldMonth > 0 &&
      worldMonth % this.intervalMonths === 0 &&
      worldMonth > this.lastCheckpointMonth;
  }

  recordIfDue(input: DeterminismFingerprintInput) {
    const month = input.worldMonth;
    if (!this.isDue(month)) return undefined;

    const checkpoint = createDeterminismCheckpoint(input);
    this.checkpoints.push(checkpoint);
    if (this.checkpoints.length > this.capacity) this.checkpoints.shift();
    this.lastCheckpointMonth = month;
    return checkpoint;
  }

  getRecent() {
    return this.checkpoints.map((checkpoint) => ({ ...checkpoint }));
  }
}
