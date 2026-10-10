import { hasRecordedRulerDeath } from "./RulerLifeState";
import type { WorldEvent } from "../History/WorldHistory";
import type { Ruler } from "./Dynasty";

export interface RulerTenureEvidence {
  totalTenureMonths: number;
  activeRuleMonths: number;
  exileMonths: number;
  exileEpisodeCount: number;
  exiledAtAccession: boolean;
  lostStateDuringTenure: boolean;
  restoredDuringTenure: boolean;
  diedInExile: boolean;
  extinctInExile: boolean;
  restoredExileMonths: number;
  monthsUntilFirstExile?: number;
}

type LifecycleEvent = { month: number; order: number; type: "EXILE" | "RESTORE" | "EXTINCT"; groupKey: string };

/** Derive a ruler's real in-state / exile timeline from canonical faction lifecycle events. */
export function deriveRulerTenureEvidence(
  ruler: Pick<Ruler, "accessionYear" | "endYear" | "endReason" | "status" | "deathMonth" | "deathReason">,
  factionId: string,
  events: WorldEvent[],
  worldMonth: number
): RulerTenureEvidence {
  const start = ruler.accessionYear ?? worldMonth;
  const end = Math.max(start, ruler.endYear ?? worldMonth);
  const totalTenureMonths = end - start;
  const lifecycle: LifecycleEvent[] = [];
  const seen = new Set<string>();
  events.forEach((event, order) => {
    let type: LifecycleEvent["type"] | undefined;
    if (event.type === "faction-exiled" && event.targetFactionId === factionId) type = "EXILE";
    else if (event.type === "faction-restored" && event.actorFactionId === factionId) type = "RESTORE";
    else if (event.type === "faction-extinct" && event.targetFactionId === factionId) type = "EXTINCT";
    if (!type) return;
    const groupKey = `${type}:${factionId}:${event.historyGroupId ?? event.id}`;
    if (seen.has(groupKey)) return;
    seen.add(groupKey);
    lifecycle.push({ month: event.monthIndex ?? event.year, order, type, groupKey });
  });
  lifecycle.sort((a, b) => a.month - b.month || a.order - b.order);

  let exiled = false;
  let exileStart: number | undefined;
  let exileMonths = 0;
  let exileEpisodeCount = 0;
  let restoredExileMonths = 0;
  let lostStateDuringTenure = false;
  let restoredDuringTenure = false;
  let extinctInExile = false;
  let exiledAtAccession = false;
  let monthsUntilFirstExile: number | undefined;

  for (const event of lifecycle) {
    if (event.month <= start) {
      if (event.type === "EXILE") {
        exiled = true;
        exileStart = event.month;
        if (event.month === start) {
          lostStateDuringTenure = true;
          monthsUntilFirstExile ??= 0;
        }
      } else if (event.type === "RESTORE" || event.type === "EXTINCT") {
        exiled = false;
        exileStart = undefined;
      }
      continue;
    }
    if (event.month > end) break;
    if (event.type === "EXILE" && !exiled) {
      exiled = true;
      exileStart = event.month;
      exileEpisodeCount += 1;
      lostStateDuringTenure = true;
      monthsUntilFirstExile ??= event.month - start;
    } else if (event.type === "RESTORE" && exiled) {
      const clippedStart = Math.max(start, exileStart ?? event.month);
      exileMonths += Math.max(0, event.month - clippedStart);
      restoredExileMonths += Math.max(0, event.month - clippedStart);
      exiled = false;
      exileStart = undefined;
      restoredDuringTenure = true;
    } else if (event.type === "EXTINCT" && exiled) {
      const clippedStart = Math.max(start, exileStart ?? event.month);
      exileMonths += Math.max(0, event.month - clippedStart);
      extinctInExile = true;
      exiled = false;
      exileStart = undefined;
    }
  }

  // A ruler can inherit an exile that began before accession.
  exiledAtAccession = lifecycle.filter((event) => event.month <= start).reduce((state, event) => {
    if (event.type === "EXILE") return true;
    if (event.type === "RESTORE" || event.type === "EXTINCT") return false;
    return state;
  }, false);
  if (exiledAtAccession) {
    exileEpisodeCount += 1;
    if (monthsUntilFirstExile === undefined && lostStateDuringTenure) monthsUntilFirstExile = 0;
  }
  if (exiled && exileStart !== undefined) {
    exileMonths += Math.max(0, end - Math.max(start, exileStart));
  }

  return {
    totalTenureMonths,
    activeRuleMonths: Math.max(0, totalTenureMonths - exileMonths),
    exileMonths,
    exileEpisodeCount,
    exiledAtAccession,
    lostStateDuringTenure,
    restoredDuringTenure,
    diedInExile: hasRecordedRulerDeath(ruler) && lifecycle
      .filter(event => event.month <= ruler.deathMonth!)
      .reduce((state, event) => event.type === "EXILE" ? true :
        event.type === "EXTINCT" && event.month === ruler.deathMonth ? state : false, false),
    extinctInExile,
    restoredExileMonths,
    monthsUntilFirstExile,
  };
}
