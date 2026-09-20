export interface InitialFactionExposureInput {
  name: string;
  x: number;
  y: number;
}

export interface InitialFactionExposure {
  factionId: string;
  nearbyOpponentCount: number;
  nearestOpponentDistance: number;
}

export function calculateInitialFactionExposure(
  factions: InitialFactionExposureInput[],
  nearDistance: number
): InitialFactionExposure[] {
  return factions.map((faction) => {
    const distances = factions
      .filter((other) => other.name !== faction.name)
      .map((other) => distance(faction, other))
      .sort((a, b) => a - b);
    return {
      factionId: faction.name,
      nearbyOpponentCount: distances.filter((item) => item <= nearDistance).length,
      nearestOpponentDistance: distances[0] ?? 0,
    };
  });
}

function distance(
  a: Pick<InitialFactionExposureInput, "x" | "y">,
  b: Pick<InitialFactionExposureInput, "x" | "y">
) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
