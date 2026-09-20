import type { Ruler } from "./Dynasty";

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
  if (chronicle.foundedStateName) {
    labels.push("开国之君");
  }
  if (chronicle.proclaimedEmperorMonth !== undefined) {
    labels.push("称帝之君");
  }
  if (chronicle.restorationsDuringReign > 0) {
    labels.push("复国之君");
  }
  if (chronicle.completedUnification) {
    labels.push("一统之君");
  }
  const end = chronicle.endSnapshot ?? chronicle.accessionSnapshot;
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
    .slice(-limit)
    .reverse();
}
