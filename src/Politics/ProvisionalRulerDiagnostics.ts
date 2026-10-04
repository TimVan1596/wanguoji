import type { Dynasty } from "./Dynasty";

interface ProvisionalFactionRecord {
  identityStage: string;
  status: string;
  sovereigntyHistory: Array<{ rank: string; startMonth: number; endMonth?: number }>;
}

export function summarizeProvisionalRulers(
  dynasties: Dynasty[],
  factions: Map<string, ProvisionalFactionRecord>,
) {
  const provisionalRulers = dynasties.flatMap((dynasty) => {
    const faction = factions.get(dynasty.factionId);
    if (!faction) return [];
    return dynasty.rulers.filter((ruler) => {
      const month = ruler.accessionYear;
      if (month === undefined) return false;
      const rank = faction.sovereigntyHistory.find((entry) => entry.startMonth <= month && (entry.endMonth === undefined || entry.endMonth >= month))?.rank;
      return rank === "LEADER";
    }).map((ruler) => ({ ruler, current: ruler.id === dynasty.currentRulerId }));
  });
  const completedTenures = provisionalRulers
    .filter(({ ruler }) => ruler.endYear !== undefined && ruler.accessionYear !== undefined)
    .map(({ ruler }) => Math.max(0, ruler.endYear! - ruler.accessionYear!))
    .sort((a, b) => a - b);
  const middle = Math.floor(completedTenures.length / 2);
  const medianCompletedTenureMonths = completedTenures.length === 0 ? undefined
    : completedTenures.length % 2 === 1 ? completedTenures[middle]
    : (completedTenures[middle - 1] + completedTenures[middle]) / 2;
  return {
    currentProvisionalRulerCount: dynasties.filter((dynasty) => {
      const faction = factions.get(dynasty.factionId);
      return Boolean(dynasty.currentRulerId && faction?.identityStage === "PROVISIONAL" && faction.status === "ACTIVE");
    }).length,
    completedProvisionalRulerCount: completedTenures.length,
    provisionalCombatDeathCount: provisionalRulers.filter(({ ruler }) => ruler.chronicle?.deathCause === "战死" || ruler.endReason === "战死").length,
    medianCompletedTenureMonths,
  };
}
