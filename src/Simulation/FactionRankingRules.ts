export interface FactionRankingTeamLike {
  status: string;
  blocks: {
    children: {
      size: number;
    };
  };
}

export function getActiveRankingFactions<T extends FactionRankingTeamLike>(
  factions: T[]
) {
  return [...factions]
    .filter((faction) => faction.status === "ACTIVE")
    .sort((a, b) => b.blocks.children.size - a.blocks.children.size);
}

export function getFactionStatusSummary(factions: Array<{ status: string }>) {
  return factions.reduce(
    (summary, faction) => {
      if (faction.status === "ACTIVE") {
        summary.active += 1;
      } else if (faction.status === "EXILED") {
        summary.exiled += 1;
      } else if (faction.status === "EXTINCT") {
        summary.extinct += 1;
      }
      return summary;
    },
    { active: 0, exiled: 0, extinct: 0 }
  );
}
