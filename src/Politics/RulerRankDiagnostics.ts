import type { Dynasty, Ruler } from "./Dynasty";

export const DIAGNOSTIC_RULER_RANKS = ["LEADER", "KING", "EMPEROR"] as const;
type Rank = typeof DIAGNOSTIC_RULER_RANKS[number];
type RankHistory = Array<{ rank: string; startMonth: number; endMonth?: number }>;

/** Recorded history only. Newer evidence wins at a shared transition month. */
export function getRecordedAccessionRank(accessionMonth: number | undefined, history: RankHistory): Rank | undefined {
  if (accessionMonth === undefined) return undefined;
  let matched: RankHistory[number] | undefined;
  for (const entry of history) {
    if (entry.startMonth <= accessionMonth && (entry.endMonth === undefined || accessionMonth <= entry.endMonth) &&
      (!matched || entry.startMonth >= matched.startMonth)) matched = entry;
  }
  return DIAGNOSTIC_RULER_RANKS.includes(matched?.rank as Rank) ? matched!.rank as Rank : undefined;
}

export function summarizeRulersByAccessionRank(
  dynasties: Dynasty[],
  factions: ReadonlyMap<string, { sovereigntyHistory: RankHistory }>,
) {
  const groups: Record<Rank, Ruler[]> = { LEADER: [], KING: [], EMPEROR: [] };
  let unknownCompletedCount = 0;
  for (const dynasty of dynasties) {
    for (const ruler of dynasty.rulers) {
      if (ruler.accessionYear === undefined || ruler.endYear === undefined) continue;
      const rank = getRecordedAccessionRank(ruler.accessionYear, factions.get(dynasty.factionId)?.sovereigntyHistory ?? []);
      if (rank) groups[rank].push(ruler);
      else unknownCompletedCount += 1;
    }
  }
  const summarize = (rulers: Ruler[]) => {
    const tenures = rulers.map((ruler) => Math.max(0, ruler.endYear! - ruler.accessionYear!)).sort((a, b) => a - b);
    const middle = Math.floor(tenures.length / 2);
    const combatDeathCount = rulers.filter((ruler) => ruler.endReason === "战死" || ruler.chronicle?.deathCause === "战死").length;
    return {
      completedCount: rulers.length, combatDeathCount,
      combatDeathRatio: rulers.length ? combatDeathCount / rulers.length : undefined,
      medianTenureMonths: tenures.length ? tenures.length % 2 ? tenures[middle] : (tenures[middle - 1] + tenures[middle]) / 2 : undefined,
      minTenureMonths: tenures[0], maxTenureMonths: tenures.at(-1),
    };
  };
  return { LEADER: summarize(groups.LEADER), KING: summarize(groups.KING), EMPEROR: summarize(groups.EMPEROR), unknownCompletedCount };
}
