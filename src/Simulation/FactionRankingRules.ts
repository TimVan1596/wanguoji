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

export function getFactionStatusSummary(
  factions: Array<{ status: string; stateFoundedMonth?: number }>
) {
  return factions.reduce(
    (summary, faction) => {
      const formalState = faction.stateFoundedMonth !== undefined;
      if (!formalState) {
        if (faction.status === "ACTIVE") summary.provisionalActive += 1;
        return summary;
      }
      if (faction.status === "ACTIVE") summary.active += 1;
      else if (faction.status === "EXILED") summary.exiled += 1;
      else if (faction.status === "EXTINCT") summary.extinct += 1;
      return summary;
    },
    { active: 0, exiled: 0, extinct: 0, provisionalActive: 0 }
  );
}
