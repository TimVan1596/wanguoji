import type { Dynasty } from "./Dynasty";
import { getRecordedAccessionRank } from "./RulerRankDiagnostics";

export interface ProvisionalFactionRecord {
  displayName?: string;
  identityStage: string;
  status: string;
  sovereigntyHistory: Array<{ rank: string; startMonth: number; endMonth?: number }>;
}

export function summarizeProvisionalRulers(
  dynasties: Dynasty[],
  factions: Map<string, ProvisionalFactionRecord>,
  window: { completedSinceMonth?: number; excludedCompletedIds?: ReadonlySet<string> } = {},
) {
  const includedCompletion = (ruler: Dynasty["rulers"][number]) => ruler.endYear !== undefined &&
    (window.completedSinceMonth === undefined || ruler.endYear >= window.completedSinceMonth) &&
    !window.excludedCompletedIds?.has(ruler.id);
  const provisionalRulers = dynasties.flatMap((dynasty) => {
    const faction = factions.get(dynasty.factionId);
    if (!faction) return [];
    return dynasty.rulers.filter((ruler) => {
      const month = ruler.accessionYear;
      if (month === undefined) return false;
      const rank = getRecordedAccessionRank(month, faction.sovereigntyHistory);
      return rank === "LEADER";
    }).map((ruler) => ({ ruler, current: ruler.id === dynasty.currentRulerId }));
  });
  const completedTenures = provisionalRulers
    .filter(({ ruler }) => includedCompletion(ruler) && ruler.accessionYear !== undefined)
    .map(({ ruler }) => Math.max(0, ruler.endYear! - ruler.accessionYear!))
    .sort((a, b) => a - b);
  const middle = Math.floor(completedTenures.length / 2);
  const medianCompletedTenureMonths = completedTenures.length === 0 ? undefined
    : completedTenures.length % 2 === 1 ? completedTenures[middle]
    : (completedTenures[middle - 1] + completedTenures[middle]) / 2;
  const byFaction = dynasties.flatMap((dynasty) => {
    const faction = factions.get(dynasty.factionId);
    if (!faction) return [];
    const rulers = dynasty.rulers.filter((ruler) => {
      if (ruler.accessionYear === undefined) return false;
      return getRecordedAccessionRank(ruler.accessionYear, faction.sovereigntyHistory) === "LEADER";
    });
    const completed = rulers.filter((ruler) => includedCompletion(ruler) && ruler.accessionYear !== undefined);
    if (completed.length === 0) return [];
    const tenures = completed.map((ruler) => Math.max(0, ruler.endYear! - ruler.accessionYear!)).sort((a, b) => a - b);
    const middleIndex = Math.floor(tenures.length / 2);
    const medianTenureMonths = tenures.length % 2 === 1 ? tenures[middleIndex] : (tenures[middleIndex - 1] + tenures[middleIndex]) / 2;
    const combatDeaths = completed.filter((ruler) => ruler.chronicle?.deathCause === "战死" || ruler.endReason === "战死").length;
    return [{
      factionId: dynasty.factionId,
      factionName: faction.displayName ?? dynasty.factionId,
      completedRulerCount: completed.length,
      combatDeathCount: combatDeaths,
      combatDeathRatio: combatDeaths / completed.length,
      medianCompletedTenureMonths: medianTenureMonths,
      shortestCompletedTenureMonths: tenures[0],
      longestCompletedTenureMonths: tenures.at(-1),
    }];
  }).sort((a, b) => b.combatDeathRatio - a.combatDeathRatio || a.medianCompletedTenureMonths - b.medianCompletedTenureMonths || b.completedRulerCount - a.completedRulerCount).slice(0, 5);
  return {
    currentProvisionalRulerCount: dynasties.filter((dynasty) => {
      const faction = factions.get(dynasty.factionId);
      return Boolean(dynasty.currentRulerId && faction?.identityStage === "PROVISIONAL" && faction.status === "ACTIVE");
    }).length,
    completedProvisionalRulerCount: completedTenures.length,
    provisionalCombatDeathCount: provisionalRulers.filter(({ ruler }) => includedCompletion(ruler) && (ruler.chronicle?.deathCause === "战死" || ruler.endReason === "战死")).length,
    combatDeathRatio: completedTenures.length === 0 ? undefined : provisionalRulers.filter(({ ruler }) => includedCompletion(ruler) &&
      (ruler.chronicle?.deathCause === "战死" || ruler.endReason === "战死")).length / completedTenures.length,
    medianCompletedTenureMonths,
    shortestCompletedTenureMonths: completedTenures[0],
    longestCompletedTenureMonths: completedTenures.at(-1),
    topAbnormalFactions: byFaction,
  };
}

/** Observational only. A load/new-world starts a new session; not stored in WorldSave. */
export class ProvisionalRulerDiagnosticsSession {
  private excludedCompletedIds = new Set<string>();

  reset(dynasties: Dynasty[]) {
    this.excludedCompletedIds = new Set(dynasties.flatMap((dynasty) => dynasty.rulers
      .filter((ruler) => ruler.endYear !== undefined).map((ruler) => ruler.id)));
  }

  summarize(dynasties: Dynasty[], factions: Map<string, ProvisionalFactionRecord>) {
    return summarizeProvisionalRulers(dynasties, factions, { excludedCompletedIds: this.excludedCompletedIds });
  }
}
