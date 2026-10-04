export const ALLIANCE_DURATION_MONTHS = 120;
export const ALLIANCE_MIN_NON_AGGRESSION_MONTHS = 24;
export const ALLIANCE_MIN_TRUCE_MONTHS_BEFORE_NON_AGGRESSION = 24;
export const STRATEGIC_UNION_MIN_ALLIANCE_MONTHS = 60;
export const STRATEGIC_UNION_MAX_WEAKER_TERRITORY_RATIO = 0.6;
export const STRATEGIC_UNION_MAX_WEAKER_CITY_RATIO = 1;
export const STRATEGIC_UNION_VERY_WEAK_TERRITORY_SHARE = 8;
export const STRATEGIC_UNION_VERY_WEAK_MAX_CITIES = 1;
export const STRATEGIC_UNION_VERY_WEAK_MAX_STABILITY = 45;

export interface FactionOriginIdentity {
  name: string;
  origin?: { type?: string; parentFactionId?: string };
}

export function areSameOriginFactions(a: FactionOriginIdentity, b: FactionOriginIdentity) {
  if (a.origin?.type === "INITIAL" && b.origin?.type === "INITIAL") return false;
  const parentA = a.origin?.parentFactionId;
  const parentB = b.origin?.parentFactionId;
  return Boolean(parentA && parentB && parentA === parentB) || parentA === b.name || parentB === a.name;
}

export interface GridCoordinate { x: number; y: number }

export function areFactionsTerritoriallyAdjacent(
  a: { blocks: { children: { entries: unknown[] } } },
  b: { blocks: { children: { entries: unknown[] } } },
  blockSize: number,
) {
  if (!Number.isFinite(blockSize) || blockSize <= 0) return false;
  const coords = (team: { blocks: { children: { entries: unknown[] } } }) =>
    (Array.isArray(team.blocks.children.entries) ? team.blocks.children.entries as Array<{ x: number; y: number }> : [])
      .filter((block) => Number.isFinite(block?.x) && Number.isFinite(block?.y))
      .map((block) => ({ x: Math.round(block.x / blockSize), y: Math.round(block.y / blockSize) }));
  return haveOrthogonalTerritoryAdjacency(coords(a), coords(b));
}

export function haveOrthogonalTerritoryAdjacency(a: GridCoordinate[], b: GridCoordinate[]) {
  const occupied = new Set(a.map(({ x, y }) => `${x},${y}`));
  return b.some(({ x, y }) =>
    occupied.has(`${x - 1},${y}`) || occupied.has(`${x + 1},${y}`) ||
    occupied.has(`${x},${y - 1}`) || occupied.has(`${x},${y + 1}`));
}

export interface StrategicUnionEvidence {
  sameOrigin: boolean;
  bothActive: boolean;
  allianceMonths: number;
  adjacent: boolean;
  bilateralWarFreeMonths: number;
  weakerTerritoryShare: number;
  strongerTerritoryShare: number;
  weakerCityCount: number;
  strongerCityCount: number;
  weakerStability: number;
  commonThreatStillRelevant: boolean;
}

export function canFormStrategicUnion(evidence: StrategicUnionEvidence) {
  if (!evidence.sameOrigin || !evidence.bothActive || !evidence.adjacent) return false;
  if (evidence.allianceMonths < STRATEGIC_UNION_MIN_ALLIANCE_MONTHS || evidence.bilateralWarFreeMonths < STRATEGIC_UNION_MIN_ALLIANCE_MONTHS) return false;
  const asymmetric = evidence.weakerTerritoryShare <= evidence.strongerTerritoryShare * STRATEGIC_UNION_MAX_WEAKER_TERRITORY_RATIO &&
    evidence.weakerCityCount <= evidence.strongerCityCount * STRATEGIC_UNION_MAX_WEAKER_CITY_RATIO;
  const veryWeak = evidence.weakerTerritoryShare <= STRATEGIC_UNION_VERY_WEAK_TERRITORY_SHARE &&
    evidence.weakerCityCount <= STRATEGIC_UNION_VERY_WEAK_MAX_CITIES &&
    evidence.weakerStability <= STRATEGIC_UNION_VERY_WEAK_MAX_STABILITY;
  return asymmetric && (evidence.commonThreatStillRelevant || veryWeak);
}
