import type Team from "../Components/Team";

export interface TerritoryMetric {
  factionId: string;
  factionControlledBlocks: number;
  absoluteWorldShare: number;
  controlledTerritoryShare: number;
}

export interface WorldTerritoryMetrics {
  totalWorldBlocks: number;
  claimableBlocks: number;
  controlledBlocks: number;
  neutralBlocks: number;
  byFactionId: Map<string, TerritoryMetric>;
}

export function calculateTerritoryMetrics(
  teams: Pick<Team, "name" | "status" | "blocks">[],
  totalWorldBlocks: number
): WorldTerritoryMetrics {
  const claimableBlocks = Math.max(1, totalWorldBlocks);
  const activeTeams = teams.filter((team) => team.status === "ACTIVE");
  const controlledBlocks = activeTeams.reduce(
    (sum, team) => sum + getBlockCount(team),
    0
  );
  const controlledDenominator = Math.max(1, controlledBlocks);
  const byFactionId = new Map<string, TerritoryMetric>();

  teams.forEach((team) => {
    const factionControlledBlocks =
      team.status === "ACTIVE" ? getBlockCount(team) : 0;
    byFactionId.set(team.name, {
      factionId: team.name,
      factionControlledBlocks,
      absoluteWorldShare: (factionControlledBlocks / claimableBlocks) * 100,
      controlledTerritoryShare:
        (factionControlledBlocks / controlledDenominator) * 100,
    });
  });

  return {
    totalWorldBlocks,
    claimableBlocks,
    controlledBlocks,
    neutralBlocks: Math.max(0, claimableBlocks - controlledBlocks),
    byFactionId,
  };
}

export function getFactionTerritoryMetric(
  metrics: WorldTerritoryMetrics,
  factionId: string
): TerritoryMetric {
  return (
    metrics.byFactionId.get(factionId) ?? {
      factionId,
      factionControlledBlocks: 0,
      absoluteWorldShare: 0,
      controlledTerritoryShare: 0,
    }
  );
}

function getBlockCount(team: Pick<Team, "blocks">) {
  return team.blocks?.children?.size ?? 0;
}
