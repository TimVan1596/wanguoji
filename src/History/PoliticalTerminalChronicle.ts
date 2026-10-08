import type { WorldEvent } from "./WorldHistory";
import type { HistoryFactionLike } from "./HistoryRenderRules";
import { getHistoricalFactionIdentity } from "./HistoricalFactionIdentity";

export interface TerminalChronicleRuler {
  id: string;
  accessionYear: number;
  endYear?: number;
  status?: string;
  endReason?: string;
}

export function isPoliticalTerminalEvent(event: WorldEvent) {
  return event.type === "faction-submitted" || event.type === "faction-merged";
}

/** Explicit recorded IDs take precedence. Legacy V11 mergers only recorded faction roles. */
export function getRulerTerminalRole(event: WorldEvent, ruler: TerminalChronicleRuler, factionId: string) {
  if (!isPoliticalTerminalEvent(event)) return undefined;
  const month = event.monthIndex ?? event.year;
  if (month < ruler.accessionYear || (ruler.endYear !== undefined && month > ruler.endYear)) return undefined;
  const m = event.metadata ?? {};
  const submitted = event.type === "faction-submitted";
  const source = submitted ? m.submittedFactionId ?? event.actorFactionId : m.absorbedFactionId ?? event.actorFactionId;
  const target = submitted ? m.receivingFactionId ?? event.targetFactionId : m.absorbingFactionId ?? m.terminationTargetFactionId ?? event.targetFactionId;
  const role = factionId === source ? "SOURCE" : factionId === target ? "RECEIVER" : undefined;
  if (!role) return undefined;
  const recordedId = role === "SOURCE"
    ? submitted ? m.submittedRulerId : m.absorbedRulerId
    : submitted ? m.receivingRulerId : m.absorbingRulerId;
  if (typeof recordedId === "string") return recordedId === ruler.id ? role : undefined;
  // No ID in older events: use the actual terminal abdication, never an arbitrary overlapped reign.
  if (role === "SOURCE") return ruler.status === "abdicated" && ruler.endYear === month &&
    ruler.endReason === (submitted ? "纳土退位" : "合邦退位") ? role : undefined;
  // A ruler whose reign ended at this boundary is not inferred to be the recipient.
  return ruler.endYear === undefined || month < ruler.endYear ? role : undefined;
}

export function formatRulerTerminalEvent(event: WorldEvent, ruler: TerminalChronicleRuler,
  factionId: string, factions: Map<string, HistoryFactionLike>) {
  const role = getRulerTerminalRole(event, ruler, factionId);
  if (!role) return undefined;
  const m = event.metadata ?? {};
  const submitted = event.type === "faction-submitted";
  const source = submitted ? m.submittedFactionId ?? event.actorFactionId : m.absorbedFactionId ?? event.actorFactionId;
  const target = submitted ? m.receivingFactionId ?? event.targetFactionId : m.absorbingFactionId ?? m.terminationTargetFactionId ?? event.targetFactionId;
  const name = (id: unknown) => typeof id === "string"
    ? (factions.has(id) ? getHistoricalFactionIdentity(factions.get(id)!, event.monthIndex ?? event.year).name : id) : "—";
  return role === "SOURCE"
    ? submitted ? `纳土退位，${name(source)}纳土归附于${name(target)}` : `合邦退位，${name(source)}归并于${name(target)}`
    : submitted ? `受纳${name(source)}来归，纳入其城市与疆域` : `吸收${name(source)}归并，纳入其城市与疆域`;
}
