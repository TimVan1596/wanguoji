import {mergePoliticalReading} from '../History/PoliticalReadingProjection';
import {isRulerHonorEvent,rulerHonorEvidence} from "./RulerHonorEvidence";
import {mergeMilitaryLifeEvents} from "./MilitaryLifePresentation";
import {militaryReignRelation} from "./RulerMilitaryBoundary";
import { selectChronicleHighlights } from "./ChronicleHighlights";
import { getRulerTerminalRole, isPoliticalTerminalEvent, type TerminalChronicleRuler } from "../History/PoliticalTerminalChronicle";
import type { WorldEvent } from "../History/WorldHistory";
import { getFactionEventRelation } from "../History/FactionEventRelation";
import { getHistorySignificance } from "../History/HistorySignificanceRules";
import type { RulerHistoricalEvidence } from "./RulerHistoriography";

export interface RulerReignSnapshot {
  month: number;
  population: number;
  territoryShare: number;
  cityCount: number;
  stability: number;
}

export interface RulerChronicle {
  accessionSnapshot: RulerReignSnapshot;
  latestSnapshot?: RulerReignSnapshot;
  endSnapshot?: RulerReignSnapshot;
  notableEventIds: string[];
  citiesCapturedPersonally: number;
  citiesLostDuringReign: number;
  rebellionsDuringReign: number;
  restorationsDuringReign: number;
  completedUnification: boolean;
  peakPopulation: number;
  peakTerritoryShare: number;
  foundedStateName?: string;
  foundedStateMonth?: number;
  proclaimedEmperorMonth?: number;
  deathCause?: string;
  deathCityId?: string;
}

export function createRulerChronicle(snapshot: RulerReignSnapshot): RulerChronicle {
  return {
    accessionSnapshot: snapshot,
    latestSnapshot: snapshot,
    notableEventIds: [],
    citiesCapturedPersonally: 0,
    citiesLostDuringReign: 0,
    rebellionsDuringReign: 0,
    restorationsDuringReign: 0,
    completedUnification: false,
    peakPopulation: snapshot.population,
    peakTerritoryShare: snapshot.territoryShare,
  };
}

export function observeRulerPeak(
  chronicle: RulerChronicle,
  snapshot: RulerReignSnapshot
) {
  chronicle.latestSnapshot = snapshot;
  chronicle.peakPopulation = Math.max(chronicle.peakPopulation, snapshot.population);
  chronicle.peakTerritoryShare = Math.max(
    chronicle.peakTerritoryShare,
    snapshot.territoryShare
  );
}

export function recordPersonalCityCapture(chronicle: RulerChronicle, eventId?: string) {
  chronicle.citiesCapturedPersonally += 1;
  if (eventId) chronicle.notableEventIds.push(eventId);
}

export function finishRulerChronicle(
  chronicle: RulerChronicle,
  snapshot: RulerReignSnapshot,
  deathCause?: string,
  deathCityId?: string
) {
  chronicle.endSnapshot = snapshot;
  chronicle.deathCause = deathCause;
  chronicle.deathCityId = deathCityId;
  observeRulerPeak(chronicle, snapshot);
}

export function getRulerTerritoryDelta(chronicle: RulerChronicle) {
  const end = getRulerEffectiveSnapshot(chronicle);
  return end.territoryShare - chronicle.accessionSnapshot.territoryShare;
}

export function getRulerEffectiveSnapshot(chronicle: RulerChronicle) {
  return chronicle.endSnapshot ?? chronicle.latestSnapshot ?? chronicle.accessionSnapshot;
}

export function buildRulerTags(evidence: RulerHistoricalEvidence) {
  const tags: string[] = [];
  if (evidence.foundedState) tags.push("开国之君");
  if (evidence.proclaimedEmperor) tags.push("称帝");
  if (evidence.completedUnification || evidence.roles.includes("UNIFIER")) tags.push("一统");
  if (evidence.restorationCount > 0 || evidence.roles.includes("RESTORER")) tags.push("复国");
  if (evidence.roles.includes("EXPANDER")) tags.push("开疆");
  if (evidence.roles.includes("DECLINER")) tags.push("国势衰退");
  if (evidence.roles.includes("STEWARD") && !evidence.roles.includes("EXPANDER")) tags.push("守成");
  if (evidence.roles.includes("EXILED_RULER")) tags.push("流亡");
  if (evidence.roles.includes("CONQUEROR")) tags.push("征服者");
  if (evidence.rebellions > 0) tags.push("内忧");
  if (evidence.roles.includes("SHORT_REIGN")) tags.push("短祚");
  if (evidence.deathCause === "战死") tags.push("战死");
  return tags.slice(0, 3);
}

const RULER_EVENT_TYPES = new Set<WorldEvent["type"]>([
  "military-ennobled", "military-appanage", "military-title-revoked", "military-posthumous",
  "heir-died",
  "ruler-died",
  "dynasty-line-ended",
  "city-captured",
  "city-recovered",
  "capital-fallen",
  "faction-restored",
  "state-founded",
  "emperor-proclaimed",
  "world-unification",
  "empire-split",
  "ruler-captured",
  "dynasty-usurped",
  "ruler-succession",
  "ruler-acceded",
  "royal-honor-granted",
  "court-coup-attempt", "court-coup-result",
  "ruler-deposed",
  "faction-extinct",
  "faction-merged",
  "faction-submitted",
  "faction-exiled",
  "faction-dissolved",
  "city-revolt",
  "rebel-faction-founded",
  "frontier-faction-founded",
  "capital-relocated",
  "dynasty-restored",
  "truce-signed",
  "non-aggression-signed",
  "alliance-signed",
  "relation-renewed",
]);

const RULER_EVENT_PRIORITIES: Partial<Record<WorldEvent["type"], number>> = {
  "ruler-died": 150,
  "dynasty-line-ended": 125,
  "faction-merged": 130,
  "faction-submitted": 130,
  "heir-died": 82,
  "state-founded": 120,
  "emperor-proclaimed": 120,
  "world-unification": 120,
  "faction-restored": 115,
  "ruler-captured": 115,
  "faction-exiled": 110,
  "faction-extinct": 110,
  "faction-dissolved": 100,
  "capital-fallen": 90,
  "capital-relocated": 100,
  "empire-split": 90,
  "dynasty-usurped": 120,
  "ruler-succession": 88,
  "ruler-acceded": 88,
  "ruler-deposed": 125,
  "city-recovered": 75,
  "city-captured": 65,
  "truce-signed": 48,
  "non-aggression-signed": 48,
  "alliance-signed": 52,
  "relation-renewed": 30,
};

const DIPLOMATIC_TYPES = new Set<WorldEvent["type"]>(["truce-signed", "non-aggression-signed", "alliance-signed", "relation-renewed"]);

export function isCoreDiplomaticEvent(event: WorldEvent, events: WorldEvent[]) {
  if (!DIPLOMATIC_TYPES.has(event.type)) return false;
  if (event.type === "alliance-signed" || event.type === "non-aggression-signed" && (event.metadata?.priorStatus === "TRUCE" || event.metadata?.preconditionStatus === "TRUCE")) return true;
  if (event.metadata?.capitalFall === 1) return true;
  return Boolean(event.historyGroupId && events.some(other => other.id !== event.id && other.historyGroupId === event.historyGroupId &&
    (other.monthIndex ?? other.year) === (event.monthIndex ?? event.year) &&
    ["capital-fallen", "faction-exiled", "faction-restored", "faction-submitted", "faction-merged"].includes(other.type) &&
    (other.factionIds ?? []).some(id => (event.factionIds ?? []).includes(id))));
}

/** Complete evidence remains separate from the bounded core biography. */
export function getRulerDiplomaticEvents(events: WorldEvent[], ruler: TerminalChronicleRuler, factionId: string, worldMonth: number) {
  return events.filter(event => {
    const month = event.monthIndex ?? event.year;
    if (month < ruler.accessionYear || month > Math.min(ruler.endYear ?? worldMonth, worldMonth)) return false;
    return isDirectRulerTreatySignature(event, ruler.id, factionId) || event.type === "relation-renewed" &&
      (event.factionIds ?? []).includes(factionId) && new Set(event.factionIds).size >= 2 &&
      (event.metadata?.signatoryARulerId === ruler.id && event.metadata?.signatoryAFactionId === factionId ||
       event.metadata?.signatoryBRulerId === ruler.id && event.metadata?.signatoryBFactionId === factionId);
  }).sort((a, b) => (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year) || a.id.localeCompare(b.id));
}

export function getRulerHistoricalEvents(
  events: WorldEvent[],
  ruler: TerminalChronicleRuler,
  factionId: string,
  worldMonth: number,
  notableEventIds: string[],
  limit = 6
) {
  return projectRulerHistoricalEvents(events,ruler,factionId,worldMonth,notableEventIds).select(limit);
}

export function projectRulerHistoricalEvents(
  events: WorldEvent[],
  ruler: TerminalChronicleRuler,
  factionId: string,
  worldMonth: number,
  notableEventIds: string[],
  royalGrantPersonIds:ReadonlySet<string>=new Set()
) {
  events=mergePoliticalReading(events);
  const endMonth = Math.min(ruler.endYear ?? worldMonth, worldMonth);
  const notable = new Set(notableEventIds);
  const sourceIds = (event: WorldEvent) =>
    typeof event.metadata?.sourceEventIds === "string"
      ? event.metadata.sourceEventIds.split(",")
      : [];
  const candidates = events.filter((event) => {
    const month = event.monthIndex ?? event.year;
    if (month < ruler.accessionYear || month > endMonth && !(event.type==="ruler-died"&&month<=worldMonth&&(event.rulerId===ruler.id||event.metadata?.rulerId===ruler.id)) || !RULER_EVENT_TYPES.has(event.type)) {
      return false;
    }
    if(event.type==='court-coup-attempt'||event.type==='court-coup-result')return event.actorFactionId===factionId&&(event.rulerId===ruler.id||event.metadata?.targetRulerId===ruler.id||event.metadata?.previousRulerId===ruler.id);
    if(event.type==='royal-honor-granted')return event.actorFactionId===factionId&&(event.rulerId===ruler.id||event.metadata?.recipientRulerId===ruler.id);
    if(isRulerHonorEvent(event))return Boolean(rulerHonorEvidence(event,ruler.id,factionId));
    if(['city-captured','city-recovered','capital-fallen'].includes(event.type)&&['BEFORE','AFTER'].includes(militaryReignRelation(event,ruler,factionId,events)))return false;
    if (DIPLOMATIC_TYPES.has(event.type) && !isCoreDiplomaticEvent(event, events)) return false;
    if (isPoliticalTerminalEvent(event)) return getRulerTerminalRole(event, ruler, factionId) !== undefined;
    if (!isRulerPoliticalEventRelevant(event, ruler.id, factionId)&&!(event.metadata?.politicalReadingKind==='FOUNDING'&&event.metadata.foundingRulerId===ruler.id&&event.actorFactionId===factionId)) return false;
    const direct =
      event.metadata?.politicalReadingKind==='FOUNDING'&&event.metadata.foundingRulerId===ruler.id ||
      event.rulerId === ruler.id ||
      event.metadata?.rulerId === ruler.id ||
      event.metadata?.previousRulerId === ruler.id ||
      event.metadata?.nextRulerId === ruler.id ||
      (event.type === "ruler-deposed" && event.metadata?.previousRulerId === ruler.id) ||
      (event.type === "dynasty-usurped" && (
        event.metadata?.predecessorRulerId === ruler.id ||
        event.metadata?.displacedSuccessorId === ruler.id
      )) ||
      event.metadata?.signatoryARulerId === ruler.id ||
      event.metadata?.signatoryBRulerId === ruler.id ||
      notable.has(event.id) ||
      sourceIds(event).some((id) => notable.has(id));
    if (direct) {
      return true;
    }
    if (event.type === "relation-renewed" || event.type === "truce-signed" || event.type === "non-aggression-signed" || event.type === "alliance-signed") {
      return false;
    }
    return event.importance === "major" && isRulerBiographyRelevantEvent(event, factionId);
  });
  // A successful usurpation and its ordinary succession record are two
  // canonical facts about the same boundary. Link them only by the recorded
  // ruler IDs, faction and exact month, then present the richer usurpation
  // record once in this ruler's biography.
  const linkedSuccession = new Map<string, string>();
  const usurpations = candidates.filter((event) => event.type === "dynasty-usurped");
  for (const succession of candidates.filter((event) => event.type === "ruler-succession")) {
    const month = succession.monthIndex ?? succession.year;
    const usurpation = usurpations.find((event) =>
      (event.monthIndex ?? event.year) === month &&
      event.actorFactionId === succession.actorFactionId &&
      event.rulerId === succession.metadata?.nextRulerId &&
      event.metadata?.predecessorRulerId === succession.metadata?.previousRulerId
    );
    if (usurpation) linkedSuccession.set(succession.id, usurpation.id);
  }
  const honorRanks=new Map(candidates.filter(isRulerHonorEvent).map(e=>[e.id,rulerHonorEvidence(e,ruler.id,factionId)?.rank]));
  const honorRank=(e:WorldEvent)=>honorRanks.get(e.id)??sourceIds(e).map(id=>honorRanks.get(id)).find(Boolean);
  const score = (event: WorldEvent) => {
    const direct =
      event.rulerId === ruler.id ||
      event.metadata?.rulerId === ruler.id ||
      event.metadata?.previousRulerId === ruler.id ||
      event.metadata?.nextRulerId === ruler.id;
    const isSignatory = event.metadata?.signatoryARulerId === ruler.id || event.metadata?.signatoryBRulerId === ruler.id;
    return (
      isRulerHonorEvent(event)?(event.type==="military-ennobled"?(honorRank(event)==="BO"?35:60):55):RULER_EVENT_PRIORITIES[event.type] ?? 40
    ) + (isRulerHonorEvent(event)&&royalGrantPersonIds.has(String(event.metadata?.personId))?25:0) + (direct || isSignatory ? 20 : 0) + (notable.has(event.id) ? 15 : 0) + (event.importance === "major" ? 5 : 0) +
      (event.type === "city-recovered" && event.metadata?.wasCapital === 1 ? 30 : 0);
  };
  // Recovering an occupied enemy capital also emits the defender's capital-loss
  // record. Their groups can differ during relocation; show the attacker's one
  // verified recovery, while retaining both original events and the losing view.
  const militaryCityKey = (event: WorldEvent) => event.actorFactionId === factionId ? getCityVictoryCompanionKey(event) : undefined;
  const recoveryIds = new Map(candidates.filter(e => e.type === "city-recovered" && militaryCityKey(e))
    .map(e => [militaryCityKey(e), e.id]));
  const grouped = new Map<string, WorldEvent>();
  for (const event of mergeMilitaryLifeEvents(candidates)) {
    const recovery = ["capital-fallen", "city-recovered"].includes(event.type) ? recoveryIds.get(militaryCityKey(event)) : undefined;
    const key = recovery ? `recovery:${recovery}` : linkedSuccession.has(event.id)
      ? `usurpation:${linkedSuccession.get(event.id)}`
      : event.type === "dynasty-usurped" && candidates.some(candidate =>
        linkedSuccession.get(candidate.id) === event.id)
        ? `usurpation:${event.id}`
        : event.historyGroupId ?? event.id;
    const boundary=event.type==="ruler-acceded"&&event.rulerId===ruler.id?`accession:${event.monthIndex??event.year}`:
      event.type==="ruler-succession"&&event.metadata?.nextRulerId===ruler.id&&!linkedSuccession.has(event.id)?`accession:${event.monthIndex??event.year}`:
      event.type==="ruler-died"&&(event.rulerId===ruler.id||event.metadata?.rulerId===ruler.id)?`ending:${event.monthIndex??event.year}`:
      event.type==="ruler-succession"&&event.metadata?.previousRulerId===ruler.id&&!linkedSuccession.has(event.id)?`ending:${event.monthIndex??event.year}`:undefined;
    const groupKey=boundary??key;
    const existing = grouped.get(groupKey);
    if (!existing || recovery && event.type === "city-recovered" ||
      !(recovery && existing.type === "city-recovered") && score(event) > score(existing)) grouped.set(groupKey, event);
  }
  const ranked = [...grouped.values()]
    .sort((a, b) => score(b) - score(a) || (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year) || a.id.localeCompare(b.id))
  const select=(limit:number)=>selectChronicleHighlights(ranked,limit,event=>{
    const month=event.monthIndex??event.year;
    const accession=month===ruler.accessionYear&&["ruler-acceded","ruler-succession","dynasty-usurped","ruler-deposed"].includes(event.type)&&
      (event.rulerId===ruler.id||event.metadata?.nextRulerId===ruler.id);
    const ending=["ruler-died","ruler-captured"].includes(event.type)||["ruler-deposed","ruler-succession"].includes(event.type)&&event.metadata?.previousRulerId===ruler.id||event.type==="dynasty-usurped"&&event.metadata?.predecessorRulerId===ruler.id;
    const turning=isPoliticalTerminalEvent(event)||getHistorySignificance(event)==="LANDMARK"||["dynasty-line-ended","dynasty-restored"].includes(event.type);
    const military=["city-captured","city-recovered","capital-fallen"].includes(event.type);
    const personal=military&&(event.rulerId===ruler.id||event.metadata?.rulerId===ruler.id);
    const capital=event.type==="capital-fallen"||event.metadata?.wasCapital===1;
    return {id:event.id,month,priority:score(event)+(accession||ending?1000:personal?500:turning?400:capital||event.type==="capital-relocated"||DIPLOMATIC_TYPES.has(event.type)?200:0),
      cityId:military?event.cityId:undefined,
      diversityGroup:isRulerHonorEvent(event)?"honors":["city-revolt","rebel-faction-founded","frontier-faction-founded","empire-split"].includes(event.type)?"local-upheaval":undefined};
  },{start:ruler.accessionYear,end:endMonth});
  return {select,get all(){return select(Infinity);}};
}

/** Capital-loss and recovery can use different political groups for the same capture.
 * Require an explicit identical actor, city, month, opponents and personal/command identity.
 * This joins companion perspectives; it never merges two recovery events. */
export function getCityVictoryCompanionKey(event:WorldEvent){
  const m=event.metadata;
  const ruler=event.rulerId??(typeof m?.rulerId==="string"?m.rulerId:undefined);
  const command=typeof m?.commandId==="string"&&typeof m.commanderPersonId==="string"&&typeof m.commanderPersonalName==="string"
    ? [m.commandId,m.commanderPersonId]:undefined;
  return event.cityId&&event.actorFactionId&&event.targetFactionId&&(ruler||command)
    ? JSON.stringify([event.monthIndex??event.year,event.cityId,event.actorFactionId,event.targetFactionId,ruler??null,command??null]):undefined;
}

export function isDirectRulerTreatySignature(event: WorldEvent, rulerId: string, factionId: string) {
  if (!["truce-signed", "non-aggression-signed", "alliance-signed"].includes(event.type) ||
      !(event.factionIds ?? []).includes(factionId) || new Set(event.factionIds ?? []).size < 2) return false;
  return (event.metadata?.signatoryARulerId === rulerId && event.metadata?.signatoryAFactionId === factionId) ||
    (event.metadata?.signatoryBRulerId === rulerId && event.metadata?.signatoryBFactionId === factionId);
}

function isRulerPoliticalEventRelevant(event: WorldEvent, rulerId: string, factionId: string) {
  const factions = event.factionIds ?? [];
  switch (event.type) {
    case "ruler-died":
      return event.actorFactionId === factionId && factions.includes(factionId) && (event.rulerId === rulerId || event.metadata?.rulerId === rulerId);
    case "dynasty-line-ended":
      return event.actorFactionId === factionId && factions.includes(factionId);
    case "heir-died":
      return event.actorFactionId === factionId && factions.includes(factionId) &&
        event.rulerId === rulerId && event.metadata?.parentRulerId === rulerId;
    case "dynasty-usurped":
      return event.actorFactionId === factionId && factions.includes(factionId) &&
        (event.rulerId === rulerId || event.metadata?.predecessorRulerId === rulerId || event.metadata?.displacedSuccessorId === rulerId);
    case "empire-split":
      return event.targetFactionId === factionId && event.metadata?.parentFactionId === factionId && factions.includes(factionId);
    case "capital-fallen":
      return factions.includes(factionId) && (event.targetFactionId === factionId && event.previousOwnerFactionId === factionId ||
        event.actorFactionId === factionId && typeof event.metadata?.commanderPersonalName === "string" &&
        typeof event.metadata?.commanderPersonId === "string" && typeof event.metadata?.commandId === "string");
    case "capital-relocated":
      return event.actorFactionId === factionId && factions.includes(factionId) && event.metadata?.cause === "CAPITAL_FALL";
    case "faction-restored":
      return event.actorFactionId === factionId && factions.includes(factionId);
    case "city-captured":
    case "city-recovered":
      return (event.actorFactionId === factionId || event.targetFactionId === factionId) && factions.includes(factionId);
    case "state-founded":
    case "emperor-proclaimed":
    case "world-unification":
    case "rebel-faction-founded":
    case "frontier-faction-founded":
    case "dynasty-restored":
      return event.actorFactionId === factionId && factions.includes(factionId);
    case "ruler-succession":
    case "ruler-acceded":
      return event.actorFactionId === factionId && factions.includes(factionId) &&
        (event.rulerId === rulerId || event.metadata?.previousRulerId === rulerId || event.metadata?.nextRulerId === rulerId);
    case "ruler-deposed":
      return event.actorFactionId === factionId && factions.includes(factionId) &&
        (event.metadata?.previousRulerId === rulerId || event.metadata?.nextRulerId === rulerId);
    case "ruler-captured":
      return event.targetFactionId === factionId && factions.includes(factionId) &&
        (event.rulerId === rulerId || event.metadata?.rulerId === rulerId);
    case "faction-exiled":
    case "faction-extinct":
    case "faction-dissolved":
      return event.targetFactionId === factionId && factions.includes(factionId);
    case "city-revolt":
      return (event.actorFactionId === factionId || event.targetFactionId === factionId) && factions.includes(factionId);
    case "truce-signed":
    case "non-aggression-signed":
    case "alliance-signed":
    case "relation-renewed":
      return factions.includes(factionId) && new Set(factions).size >= 2 &&
        ((event.metadata?.signatoryARulerId === rulerId && event.metadata?.signatoryAFactionId === factionId) ||
          (event.metadata?.signatoryBRulerId === rulerId && event.metadata?.signatoryBFactionId === factionId));
    default:
      return true;
  }
}

export function isRulerBiographyRelevantEvent(event: WorldEvent, factionId: string) {
  const relation = getFactionEventRelation(event, factionId);
  if (relation === "NONE") return false;
  if (event.type === "city-captured" || event.type === "city-recovered" || event.type === "capital-fallen") {
    // Being the city's founder must not mask a real in-tenure recovery by the
    // same faction; a founder without an acting/losing role still gets no credit.
    return event.actorFactionId === factionId || event.targetFactionId === factionId ||
      event.conquerorFactionId === factionId || event.previousOwnerFactionId === factionId;
  }
  return true;
}
