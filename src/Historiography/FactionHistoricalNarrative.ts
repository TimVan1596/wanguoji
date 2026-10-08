import { deriveFactionHistoricalArguments, selectFactionHistoricalArguments, getFinalFactionLoss } from "./FactionHistoricalArguments";
import { buildFactionTimeline, factionTerminalWording } from "./FactionNarrativeTimeline";
import type { WorldEvent, WorldEventType } from "../History/WorldHistory";
import type { Ruler } from "../Politics/Dynasty";
import type { FactionHistoricalEvidence, FactionHistoryContext } from "./FactionHistoriography";
import { getFactionDisplayNameAtMonth } from "../Simulation/FactionIdentity";
import { formatWorldDate, formatWorldDuration } from "../Simulation/WorldTime";

export type NarrativeRole = "ACTOR" | "TARGET" | "CONQUEROR" | "SUBMITTED" | "RECEIVING" | "ABSORBED";
export interface FactionNarrativeEvidence {
  eventId: string; month: number; type: WorldEventType; factionId: string; factionRole: NarrativeRole;
  factionName: string; cityId?: string; cityName?: string; rulerId?: string; rulerName?: string;
  actorName?: string; targetName?: string; actorFactionId?: string; targetFactionId?: string; conquerorFactionId?: string; historyGroupId?: string;
  metadata: Readonly<NonNullable<WorldEvent["metadata"]>>;
}
const RELEVANT = new Set<WorldEventType>(["world-born", "rebel-faction-founded", "frontier-faction-founded", "empire-split", "state-founded", "emperor-proclaimed", "world-unification", "world-hegemony", "dynasty-usurped", "capital-fallen", "capital-relocated", "city-captured", "city-recovered", "faction-exiled", "faction-restored", "dynasty-restored", "faction-merged", "faction-submitted", "dynasty-line-ended", "faction-extinct"]);
const str = (event: WorldEvent, key: string) => typeof event.metadata?.[key] === "string" ? event.metadata[key] as string : undefined;

// A related-faction index is a query accelerator, never evidence of who acted.
export function collectFactionNarrativeEvidence(c: FactionHistoryContext): FactionNarrativeEvidence[] {
  const id = c.faction.name;
  const name = (factionId: string | undefined, month: number) => {
    if (!factionId) return undefined;
    const f = c.factions.get(factionId);
    return f ? getFactionDisplayNameAtMonth(f, month) : undefined;
  };
  const ownRulers = new Map(c.dynasty?.rulers.map(r => [r.id, r]) ?? []);
  const seen = new Set<string>();
  const result: FactionNarrativeEvidence[] = [];
  for (const event of c.events) {
    const month = event.monthIndex ?? event.year;
    if (!RELEVANT.has(event.type) || seen.has(event.id) || month > (c.lifetime.terminal?.month ?? c.lifetime.lastObservedMonth)) continue;
    let role: NarrativeRole | undefined;
    if (event.type === "faction-submitted") {
      if ((str(event, "submittedFactionId") ?? event.actorFactionId) === id) role = "SUBMITTED";
      else if (str(event, "receivingFactionId") === id || event.targetFactionId === id) role = "RECEIVING";
    } else if (event.type === "faction-merged") {
      if (str(event, "absorbedFactionId") === id) role = "ABSORBED";
      else if (str(event, "absorbingFactionId") === id || event.actorFactionId === id) role = "RECEIVING";
    } else if (event.targetFactionId === id || event.previousOwnerFactionId === id) role = "TARGET";
    else if (event.actorFactionId === id) role = "ACTOR";
    else if (event.conquerorFactionId === id) role = "CONQUEROR";
    // world-born is explicit evidence of initial participants, not a war role.
    else if (event.type === "world-born" && event.factionIds?.includes(id)) role = "ACTOR";
    if (!role) continue;
    const rulerId = event.rulerId ?? str(event, "rulerId") ??
      (role === "SUBMITTED" ? str(event, "submittedRulerId") : role === "RECEIVING" ? str(event, "receivingRulerId") : undefined);
    const rulerFactionId = (event.type === "city-captured" || event.type === "capital-fallen")
      ? event.actorFactionId ?? event.conquerorFactionId : id;
    const ruler: Ruler | undefined = rulerId && rulerFactionId ? (rulerFactionId === id
      ? ownRulers.get(rulerId) : c.resolveRuler?.(rulerId, rulerFactionId)) : undefined;
    // Use only a documented ID belonging to the acting faction, during its real reign.
    const inReign = ruler && ruler.id === rulerId && ruler.accessionYear !== undefined && ruler.accessionYear <= month && (ruler.endYear === undefined || ruler.endYear >= month);
    const rulerFaction = rulerFactionId ? c.factions.get(rulerFactionId) : undefined;
    const rank = rulerFaction?.sovereigntyHistory.slice().reverse().find(h => h.startMonth <= month && (h.endMonth === undefined || month <= h.endMonth))?.rank;
    const rulerName = inReign ? `${name(rulerFactionId, month) ?? ""}${rank === "EMPEROR" ? "帝" : rank === "KING" ? "王" : rank === "LEADER" ? "首领" : ""}${ruler!.houseName.replace(/氏$/, "")}${ruler!.givenName}` : undefined;
    result.push({ eventId: event.id, month, type: event.type, factionId: id, factionRole: role,
      factionName: name(id, month)!, cityId: event.cityId ?? str(event, "cityId"), cityName: event.cityName ?? str(event, "cityName"),
      rulerId, rulerName, actorFactionId: event.actorFactionId, targetFactionId: event.targetFactionId, conquerorFactionId: event.conquerorFactionId, actorName: name(event.actorFactionId ?? event.conquerorFactionId, month), targetName: name(event.targetFactionId, month),
      historyGroupId: event.historyGroupId, metadata: { ...event.metadata } });
    seen.add(event.id);
  }
  return result.sort((a, b) => a.month - b.month || a.eventId.localeCompare(b.eventId));
}

export function buildFactionHistoricalNarrative(e: FactionHistoricalEvidence, events: readonly FactionNarrativeEvidence[]) {
  const arguments_ = deriveFactionHistoricalArguments(e, events);
  const selectedArguments = selectFactionHistoricalArguments(arguments_);
  const milestones = buildFactionTimeline(e, events, selectedArguments);
  const narrative = milestones.map(x => `${x.text}。`);
  const end = factionTerminalWording(e, events);
  const lines = selectedArguments.map(x => x.judgment);
  if (!selectedArguments.some(x => x.axis === "POLITICAL_END")) lines.push(`${formatWorldDate(e.endMonth!)}，${end}。`);
  const voice = selectedArguments.map(x => x.voice).join("");
  const loss = e.ending === "EXTINCT" ? getFinalFactionLoss(events)?.loss : undefined;
  const lossText = milestones.find(x => x.kind === "FINAL_LOSS")?.text;
  const summary = `${e.formal ? `${e.name}正式国祚${formatWorldDuration(e.formalMonths!)}，历${e.formalRulerCount}君` : `${e.name}势力历时${formatWorldDuration(e.lifetimeMonths)}，历${e.rulerCount}位首领`}。${lossText ? `${lossText}；${formatWorldDate(e.endMonth!)}终结${loss && e.endMonth! > loss.month ? `，相隔${formatWorldDuration(e.endMonth! - loss.month)}` : ""}。` : `${formatWorldDate(e.endMonth!)}，${end}。`}`;
  return { narrative, lines, voice, summary, milestones, arguments: arguments_, selectedArguments };
}
