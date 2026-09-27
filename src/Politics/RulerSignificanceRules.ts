import type { Ruler } from "./Dynasty";
import { buildRulerLegacyEvidence, getRulerLegacyClasses, getRulerLegacyScore } from "./RulerLegacyEvidence";

export interface ImportantRuler {
  ruler: Ruler;
  labels: string[];
}

const LONG_REIGN_MONTHS = 25 * 12;

export function getRulerSignificanceLabels(ruler: Ruler, worldMonth: number) {
  const chronicle = ruler.chronicle;
  if (!chronicle || ruler.accessionYear === undefined || ruler.reignOrdinal === undefined) {
    return [];
  }
  const labels: string[] = [];
  const evidence = buildRulerLegacyEvidence(chronicle, ruler.accessionYear, ruler.endYear, ruler.endReason);
  const classes = getRulerLegacyClasses(evidence);
  if (classes.includes("FOUNDING")) {
    labels.push("开国之君");
  }
  if (chronicle.proclaimedEmperorMonth !== undefined) {
    labels.push("称帝之君");
  }
  if (classes.includes("RESTORATION")) {
    labels.push("复国之君");
  }
  if (classes.includes("UNIFICATION")) {
    labels.push("一统之君");
  }
  const end = evidence.endSnapshot ?? evidence.latestSnapshot ?? evidence.accessionSnapshot;
  const reignMonths = Math.max(0, (ruler.endYear ?? worldMonth) - ruler.accessionYear);
  const territoryDelta = end.territoryShare - chronicle.accessionSnapshot.territoryShare;
  const cityDelta = end.cityCount - chronicle.accessionSnapshot.cityCount;
  if (reignMonths >= LONG_REIGN_MONTHS && (territoryDelta >= 0.12 || cityDelta >= 2)) {
    labels.push("长治开疆");
  }
  return labels.slice(0, 2);
}

export function getImportantRulers(
  rulers: Ruler[],
  worldMonth: number,
  limit = 5
) {
  return rulers
    .map((ruler) => ({
      ruler,
      labels: getRulerSignificanceLabels(ruler, worldMonth),
    }))
    .filter((item) => item.labels.length > 0)
    .sort((a, b) => getRulerLegacyScore(buildRulerLegacyEvidence(b.ruler.chronicle!, b.ruler.accessionYear!, b.ruler.endYear, b.ruler.endReason)) - getRulerLegacyScore(buildRulerLegacyEvidence(a.ruler.chronicle!, a.ruler.accessionYear!, a.ruler.endYear, a.ruler.endReason)))
    .slice(0, limit);
}
