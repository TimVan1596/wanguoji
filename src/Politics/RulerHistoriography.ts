import {formatPoliticalEvent,politicalCauseText} from "./PoliticalEventNarrative";
import {militaryReignRelation} from "./RulerMilitaryBoundary";
import { deriveRulerReignTrajectory, type RulerReignTrajectory } from "./RulerReignTrajectory";
import { normalizeRulerPoliticalFacts, summarizeRulerPoliticalFacts } from "./RulerPoliticalFacts";
import { hasRecordedRulerDeath } from "./RulerLifeState";
import type { WorldEvent } from "../History/WorldHistory";
import type { Dynasty, Ruler } from "./Dynasty";
import { createRulerChronicle, getRulerEffectiveSnapshot, getCityVictoryCompanionKey } from "./RulerChronicle";
import { monthsToYears } from "../Simulation/WorldTime";
import { deriveRulerTenureEvidence, type RulerTenureEvidence } from "./RulerTenureEvidence";
import { buildRulerLegacyEvidence } from "./RulerLegacyEvidence";
import { getRulerTerminalRole } from "../History/PoliticalTerminalChronicle";
import { getRecordedKinRelation, type RecordedKinRelation } from "./DynasticCandidateRules";
import { formatWorldDate } from "../Simulation/WorldTime";

export type HistoricalRole =
  | "FOUNDER"
  | "IMPERIAL_FOUNDER"
  | "RESTORER"
  | "UNIFIER"
  | "EXPANDER"
  | "CONQUEROR"
  | "STEWARD"
  | "CRISIS_SURVIVOR"
  | "PEAK_AND_RETREAT"
  | "INHERITED_HIGH_DECLINE"
  | "MODERATE_RECOVERY"
  | "DECLINER"
  | "LAST_RULER"
  | "SHORT_REIGN"
  | "TRAGIC_RULER"
  | "CONTESTED_REIGN"
  | "EXILED_RULER"
  | "LONG_EXILE"
  | "RESTORED_FROM_EXILE";

export interface RulerHistoricalEvidence {
  trajectory: RulerReignTrajectory;
  rulerId: string;
  factionId: string;
  accessionAge?: number;
  finalAge?: number;
  hasRecordedDeath: boolean;
  reignMonths: number;
  tenure: RulerTenureEvidence;
  isFinalized: boolean;
  rulerStatus?: Ruler["status"];
  deathMonth?: number;
  deathReason?: Ruler["deathReason"];
  foundedFaction: boolean;
  foundedState: boolean;
  formalStateAtReignEnd: boolean;
  foundedStateName?: string;
  monthsSinceStateFoundationAtEnd?: number;
  monthsSinceFactionFoundationAtEnd?: number;
  proclaimedEmperor: boolean;
  completedUnification: boolean;
  restorationCount: number;
  observedPeakCityCount: number;
  startPopulation: number;
  endPopulation: number;
  peakPopulation: number;
  startTerritory: number;
  endTerritory: number;
  peakTerritory: number;
  startCityCount: number;
  endCityCount: number;
  startStability: number;
  endStability: number;
  personalCityCaptures: number;
  citiesLost: number;
  rebellions: number;
  deathCause?: string;
  endReason?: string;
  forcedCapitalRelocationsDuringReign: number;
  directlyAttributedCapitalRelocations: number;
  factionsDestroyedByFactionDuringReign: number;
  factionsDestroyedDirectlyAttributedToRuler: number;
  predeceasedHeirCount: number;
  territorialPeakRetreat: number;
  territorialPeakGain: number;
  populationPeakRetreat: number;
  populationPeakGain: number;
  territoryDelta: number;
  populationDelta: number;
  cityDelta: number;
  stabilityDelta: number;
  stableGovernanceEligible: boolean;
  longStableReign: boolean;
  governanceCost: boolean;
  accessionCrisis: boolean;
  terminalCollapse: boolean;
  roles: HistoricalRole[];
  /** Derived political facts, each retaining its canonical source event and role. */
  politicalFacts: RulerPoliticalFact[];
}

export interface RulerPoliticalFact {
  politicalCause?:string; politicalNarrative?:string;
  eventId: string;
  historyGroupId?: string;
  month: number;
  factionId: string;
  rulerId?: string;
  role: "DIRECT_ACTOR" | "SUBJECT" | "IN_TENURE" | "BACKGROUND";
  type: WorldEvent["type"];
  confidence: "DIRECT" | "TENURE" | "CONTEXT";
  outcome: string;
  suitableForAssessment: boolean;
  participantRole?: "SOURCE" | "RECEIVER";
  usurpationRole?: "USURPER" | "PREDECESSOR" | "DISPLACED_SUCCESSOR";
  depositionRole?: "DEPOSED_RULER" | "DEPOSING_SUCCESSOR";
  relatedRulerId?: string;
  relatedRulerName?: string;
  recordedKinRelation?: RecordedKinRelation;
  oldHouseName?: string;
  newHouseName?: string;
  displacedSuccessorName?: string;
  oldStateName?: string;
  newStateName?: string;
  affectedFactionId?: string;
  cityId?: string;
  cityName?: string;
  wasCapital?: boolean;
  terminalOutcome?: "EXTINCT" | "DISSOLVED" | "EXILED";
  militaryRole?: "ATTACKER" | "DEFENDER";
}

export interface RulerHistoriographyContext {
  ruler: Ruler;
  dynasty: Pick<Dynasty, "rulers">;
  faction: {
    name: string;
    origin?: { foundingRulerId?: string; foundedMonth?: number };
    stateFoundedMonth?: number;
  };
  events: WorldEvent[];
  worldMonth: number;
}

export function formatPredeceasedHeirAssessment(count: number) {
  if (count <= 0) return undefined;
  if (count === 1) return "有1名继承候选先于其去世，继承秩序因此受到冲击。";
  return `先后有${count}名继承候选先于其去世，晚年继统屡有变数，继承秩序因此受到冲击。`;
}

export interface RulerAssessment {
  heading: "史评" | "在位评议";
  evidence: RulerHistoricalEvidence;
  lines: string[];
}

const FOUNDING_EARLY_DEATH_MAX_MONTHS = 60;

const COLLAPSE_TYPES = new Set<WorldEvent["type"]>([
  "faction-exiled",
  "faction-extinct",
  "faction-dissolved",
]);

/** Frozen adjudication scope: posthumous naming continues to use its existing evidence. */
export function deriveRulerHistoricalEvidence(context:RulerHistoriographyContext):RulerHistoricalEvidence {
  return deriveRulerEvidence(context,false);
}
/** Display audit includes real recoveries; never feeds back into saved names or adjudication. */
export function deriveRulerPresentationEvidence(context:RulerHistoriographyContext):RulerHistoricalEvidence {
  return deriveRulerEvidence(context,true);
}
function deriveRulerEvidence(
  context: RulerHistoriographyContext, includeRecoveredCaptures:boolean
): RulerHistoricalEvidence {
  const { ruler, dynasty, faction, events, worldMonth } = context;
  const chronicle = ruler.chronicle;
  const start = chronicle?.accessionSnapshot;
  const end = chronicle ? getRulerEffectiveSnapshot(chronicle) : undefined;
  const accessionMonth = ruler.accessionYear ?? start?.month ?? worldMonth;
  const endMonth = ruler.endYear ?? worldMonth;
  const isFinalized = ruler.endYear !== undefined;
  const tenure = deriveRulerTenureEvidence(ruler, faction.name, events, worldMonth);
  const inReign = (event: WorldEvent) => {
    const month = event.monthIndex ?? event.year;
    if(['city-captured','city-recovered','capital-fallen'].includes(event.type)&&militaryReignRelation(event,{...ruler,accessionYear:accessionMonth},faction.name,events)!=='DURING')return false;
    return month >= accessionMonth && month <= endMonth && (!includeRecoveredCaptures || month <= worldMonth);
  };
  const directToRuler = (event: WorldEvent) =>
    event.rulerId === ruler.id || event.metadata?.rulerId === ruler.id;
  const rulerEvents = events.filter(inReign);
  const recoveryKeys=includeRecoveredCaptures?new Set(rulerEvents.filter(e=>e.type==="city-recovered").map(getCityVictoryCompanionKey).filter(Boolean)):new Set<string>();
  const capitalKeys=includeRecoveredCaptures?new Set(rulerEvents.filter(e=>e.type==="capital-fallen").map(getCityVictoryCompanionKey).filter(Boolean)):new Set<string>();
  const rawPoliticalFacts: RulerPoliticalFact[] = rulerEvents.flatMap((event) => {
    const recoveryKey=getCityVictoryCompanionKey(event);
    if(includeRecoveredCaptures&&recoveryKey&&(
      event.type==="capital-fallen"&&event.actorFactionId===faction.name&&recoveryKeys.has(recoveryKey)||
      event.type==="city-recovered"&&event.targetFactionId===faction.name&&capitalKeys.has(recoveryKey)))return [];
    const month = event.monthIndex ?? event.year;
    const factionParticipant = (event.factionIds ?? []).includes(faction.name) ||
      event.relatedFactionIds?.includes(faction.name) || event.actorFactionId === faction.name ||
      event.targetFactionId === faction.name || event.conquerorFactionId === faction.name;
    const diplomacy = ["truce-signed", "non-aggression-signed", "alliance-signed", "relation-renewed"].includes(event.type);
    let direct = false;
    let subject = false;
    let participantRole: RulerPoliticalFact["participantRole"];
    let usurpationRole: RulerPoliticalFact["usurpationRole"];
    let depositionRole: RulerPoliticalFact["depositionRole"];
    let relatedRulerId: string | undefined;
    let relatedRulerName: string | undefined;
    let recordedKinRelation: RecordedKinRelation | undefined;
    let affectedFactionId: string | undefined;
    let cityId: string | undefined;
    let cityName: string | undefined;
    let wasCapital: boolean | undefined;
    let terminalOutcome: RulerPoliticalFact["terminalOutcome"];
    let militaryRole: RulerPoliticalFact["militaryRole"];
    if (diplomacy) {
      const signerA = event.metadata?.signatoryARulerId === ruler.id && event.metadata?.signatoryAFactionId === faction.name;
      const signerB = event.metadata?.signatoryBRulerId === ruler.id && event.metadata?.signatoryBFactionId === faction.name;
      if (!factionParticipant || new Set(event.factionIds ?? []).size < 2) return [];
      direct = event.type !== "relation-renewed" && (signerA || signerB) && (event.factionIds ?? []).includes(faction.name);
    } else if (event.type === "dynasty-usurped") {
      if (event.actorFactionId !== faction.name || !event.factionIds?.includes(faction.name)) return [];
      if (event.rulerId === ruler.id) {
        direct = true;
        usurpationRole = "USURPER";
      } else if (event.metadata?.predecessorRulerId === ruler.id) {
        usurpationRole = "PREDECESSOR";
      } else if (event.metadata?.displacedSuccessorId === ruler.id) {
        usurpationRole = "DISPLACED_SUCCESSOR";
      } else return [];
    } else if (event.type === "ruler-deposed") {
      const previousId = event.metadata?.previousRulerId;
      const nextId = event.metadata?.nextRulerId;
      const previous = dynasty.rulers.find((person) => person.id === previousId);
      const next = dynasty.rulers.find((person) => person.id === nextId);
      const personName = (person: Ruler) => `${person.houseName.replace(/氏$/, "")}${person.givenName}`;
      if (event.actorFactionId !== faction.name || !event.factionIds?.includes(faction.name) ||
          event.metadata?.factionId !== faction.name || event.metadata?.month !== month ||
          typeof previousId !== "string" || typeof nextId !== "string" || previousId === nextId ||
          !previous || !next || previous.houseName !== next.houseName ||
          event.metadata?.previousHouseName !== previous.houseName || event.metadata?.nextHouseName !== next.houseName ||
          event.metadata?.previousRulerName !== personName(previous) || event.metadata?.nextRulerName !== personName(next) ||
          previous.endYear !== month || previous.endReason !== "被废" || !["deposed", "dead"].includes(previous.status) ||
          next.accessionYear !== month || next.accessionCause !== "DEPOSITION" || next.predecessorId !== previous.id ||
          event.rulerId !== next.id) return [];
      recordedKinRelation = getRecordedKinRelation(next, previous, dynasty.rulers);
      if (!recordedKinRelation || recordedKinRelation === "COLLATERAL_KIN" || event.metadata?.relation !== recordedKinRelation) return [];
      if (ruler.id === previous.id) {
        subject = true;
        depositionRole = "DEPOSED_RULER";
        relatedRulerId = next.id;
        relatedRulerName = personName(next);
      } else if (ruler.id === next.id) {
        direct = true;
        depositionRole = "DEPOSING_SUCCESSOR";
        relatedRulerId = previous.id;
        relatedRulerName = personName(previous);
      } else return [];
    } else if (event.type === "heir-died") {
      const candidate = dynasty.rulers.find((person) => person.id === event.metadata?.heirId);
      if (event.actorFactionId !== faction.name || !event.factionIds?.includes(faction.name) ||
          event.rulerId !== ruler.id || event.metadata?.parentRulerId !== ruler.id ||
          !candidate || candidate.parentId !== ruler.id || candidate.reignOrdinal !== undefined ||
          !hasRecordedRulerDeath(candidate)) return [];
    } else if (event.type === "empire-split") {
      if (event.targetFactionId !== faction.name || event.metadata?.parentFactionId !== faction.name ||
          !event.factionIds?.includes(faction.name) || !event.actorFactionId || event.actorFactionId === faction.name) return [];
    } else if (event.type === "capital-relocated") {
      if (event.actorFactionId !== faction.name || !event.factionIds?.includes(faction.name) || event.metadata?.cause !== "CAPITAL_FALL") return [];
    } else if (event.type === "city-captured" || event.type === "capital-fallen" || includeRecoveredCaptures && event.type === "city-recovered") {
      cityId = event.cityId ?? (typeof event.metadata?.cityId === "string" ? event.metadata.cityId : undefined);
      cityName = event.cityName ?? (typeof event.metadata?.cityName === "string" ? event.metadata.cityName : undefined);
      wasCapital = event.metadata?.wasCapital === 0 ? false : event.metadata?.wasCapital === 1 || event.type === "capital-fallen";
      if(includeRecoveredCaptures&&event.type==="city-recovered"&&recoveryKey&&capitalKeys.has(recoveryKey))wasCapital=true;
      const attacker = event.actorFactionId === faction.name && event.targetFactionId !== faction.name && Boolean(event.targetFactionId) && event.factionIds?.includes(faction.name);
      const defender = event.targetFactionId === faction.name && event.factionIds?.includes(faction.name);
      if (!attacker && !defender) return [];
      affectedFactionId = attacker ? event.targetFactionId : faction.name;
      if (attacker) {
        militaryRole = "ATTACKER";
        direct = directToRuler(event);
      } else {
        militaryRole = "DEFENDER";
        participantRole = "RECEIVER";
      }
    } else if (event.type === "faction-extinct" || event.type === "faction-dissolved" || event.type === "faction-exiled") {
      terminalOutcome = event.type === "faction-extinct" ? "EXTINCT" : event.type === "faction-dissolved" ? "DISSOLVED" : "EXILED";
      const conqueror = event.conquerorFactionId ?? (typeof event.metadata?.conquerorFactionId === "string" ? event.metadata.conquerorFactionId : undefined);
      const target = event.targetFactionId ?? (typeof event.metadata?.factionId === "string" ? event.metadata.factionId :
        (event.factionIds ?? []).includes(faction.name) ? faction.name : undefined);
      const attacker = conqueror === faction.name && Boolean(target) && target !== faction.name;
      const defender = target === faction.name;
      if (!attacker && !defender) return [];
      affectedFactionId = target;
      if (attacker) {
        militaryRole = "ATTACKER";
        const sameCampaignDirectAction = Boolean(event.historyGroupId && rulerEvents.some((related) =>
          related.historyGroupId === event.historyGroupId && related.actorFactionId === faction.name &&
          (related.type === "city-captured" || related.type === "capital-fallen") && directToRuler(related)));
        direct = directToRuler(event) || event.metadata?.conquerorRulerId === ruler.id || sameCampaignDirectAction;
        participantRole = "SOURCE";
      } else {
        militaryRole = "DEFENDER";
        participantRole = "RECEIVER";
      }
    } else if (event.type === "faction-restored") {
      if (event.actorFactionId !== faction.name || !event.factionIds?.includes(faction.name)) return [];
      direct = event.rulerId === ruler.id || event.metadata?.rulerId === ruler.id;
    } else if (event.type === "faction-submitted" || event.type === "faction-merged") {
      if (!event.factionIds?.includes(faction.name)) return [];
      participantRole = getRulerTerminalRole(event, { ...ruler, accessionYear: ruler.accessionYear ?? accessionMonth }, faction.name);
      if (!participantRole) return [];
      direct = participantRole === "SOURCE";
    } else {
      return [];
    }
    const role: RulerPoliticalFact["role"] = direct ? "DIRECT_ACTOR" : subject ? "SUBJECT" : "IN_TENURE";
    const outcome = event.type === "ruler-deposed" ? (subject ? "被宗室废黜" : "经宗室废立取得君位") :
      event.type === "dynasty-usurped" ? "夺取王统" :
      event.type === "empire-split" ? "发生重大分裂" :
      event.type === "capital-fallen" ? (militaryRole === "ATTACKER"
        ? direct ? "亲自参与攻陷当时都城" : "任内本国攻陷都城"
        : "本国失去都城") :
      event.type === "city-recovered" ? (militaryRole === "ATTACKER" ? direct ? "本人参与收复城市" : "任内本国收复城市" : "本国失去城市") :
      event.type === "city-captured" ? (militaryRole === "DEFENDER" ? wasCapital ? "本国失去都城" : "本国失去城市" : direct ? "亲自参与攻占城市" : "任内本国攻占城市") :
      event.type === "faction-extinct" ? "政权彻底灭亡" :
      event.type === "faction-dissolved" ? "失去最后据点后残部解散" :
      event.type === "faction-exiled" ? "失去疆土并进入流亡" :
      event.type === "capital-relocated" ? "被迫迁都" :
      event.type === "faction-restored" ? "国家复国" :
      event.type === "heir-died" ? "继承候选先逝" :
      event.type === "alliance-signed" ? "结成战略同盟" :
      event.type === "non-aggression-signed" ? "订立互不侵犯之约" :
      event.type === "truce-signed" ? "议定停战" :
      event.type === "relation-renewed" ? "外交关系续约" : "政治关系终结或合并";
    const metadata = event.metadata ?? {};
    return [{ eventId: event.id, historyGroupId: event.historyGroupId, month, factionId: faction.name, rulerId: direct || subject ? ruler.id : undefined,
      role, type: event.type, confidence: direct || subject ? "DIRECT" : "TENURE", participantRole, usurpationRole,
      politicalCause:politicalCauseText(event),politicalNarrative:formatPoliticalEvent(event),
      depositionRole, relatedRulerId, relatedRulerName, recordedKinRelation,
      oldHouseName: typeof metadata.oldHouseName === "string" ? metadata.oldHouseName : undefined,
      newHouseName: typeof metadata.newHouseName === "string" ? metadata.newHouseName : undefined,
      displacedSuccessorName: typeof metadata.displacedSuccessorName === "string" ? metadata.displacedSuccessorName : undefined,
      oldStateName: typeof metadata.oldStateName === "string" ? metadata.oldStateName : undefined,
      newStateName: typeof metadata.newStateName === "string" ? metadata.newStateName : undefined,
      affectedFactionId, cityId, cityName, wasCapital, terminalOutcome, militaryRole,
      outcome, suitableForAssessment: !diplomacy || event.type !== "relation-renewed" }];
  });

  const politicalFacts = normalizeRulerPoliticalFacts(rawPoliticalFacts);
  const politicalStats = summarizeRulerPoliticalFacts(politicalFacts);
  const restorationCount = Math.max(chronicle?.restorationsDuringReign ?? 0, politicalStats.restorations, tenure.restorationCount);

  const foundingFactionEvent = rulerEvents.find(
    (event) =>
      (event.type === "rebel-faction-founded" || event.type === "frontier-faction-founded") &&
      event.actorFactionId === faction.name &&
      event.metadata?.foundingRulerId === ruler.id
  );
  const foundedFaction = faction.origin?.foundingRulerId === ruler.id || Boolean(foundingFactionEvent);
  const stateFoundingEvent = rulerEvents.find(
    (event) =>
      event.type === "state-founded" &&
      event.actorFactionId === faction.name &&
      directToRuler(event)
  );
  const foundedState = Boolean(
    stateFoundingEvent ||
      (chronicle?.foundedStateName &&
        chronicle.foundedStateMonth !== undefined &&
        chronicle.foundedStateMonth >= accessionMonth &&
        chronicle.foundedStateMonth <= endMonth)
  );
  const foundedStateName = foundedState
    ? chronicle?.foundedStateName ??
      (typeof stateFoundingEvent?.metadata?.newDisplayName === "string"
        ? stateFoundingEvent.metadata.newDisplayName
        : undefined)
    : undefined;
  const stateFoundationMonth = chronicle?.foundedStateMonth ?? (
    stateFoundingEvent ? stateFoundingEvent.monthIndex ?? stateFoundingEvent.year : undefined
  );
  const factionFoundationMonth = (faction.origin?.foundingRulerId === ruler.id
    ? faction.origin.foundedMonth
    : undefined) ?? (foundingFactionEvent ? foundingFactionEvent.monthIndex ?? foundingFactionEvent.year : undefined);
  const monthsSinceStateFoundationAtEnd = foundedState && stateFoundationMonth !== undefined
    ? Math.max(0, endMonth - stateFoundationMonth)
    : undefined;
  const monthsSinceFactionFoundationAtEnd = foundedFaction && factionFoundationMonth !== undefined
    ? Math.max(0, endMonth - factionFoundationMonth)
    : undefined;
  const formalStateAtReignEnd = foundedState || (
    faction.stateFoundedMonth !== undefined && faction.stateFoundedMonth <= endMonth
  );
  const proclaimedEmperor = Boolean(
    chronicle?.proclaimedEmperorMonth !== undefined &&
      chronicle.proclaimedEmperorMonth >= accessionMonth &&
      chronicle.proclaimedEmperorMonth <= endMonth
  ) || rulerEvents.some(
    (event) => event.type === "emperor-proclaimed" && event.actorFactionId === faction.name && directToRuler(event)
  );
  const completedUnification = Boolean(chronicle?.completedUnification);

  const capitalRelocations = rulerEvents.filter(
    (event) =>
      event.type === "capital-relocated" &&
      event.actorFactionId === faction.name &&
      event.metadata?.cause === "CAPITAL_FALL"
  );
  const directlyAttributedCapitalRelocations = capitalRelocations.filter(directToRuler).length;

  const collapseGroups = new Map<string, WorldEvent>();
  rulerEvents
    .filter((event) => COLLAPSE_TYPES.has(event.type))
    .forEach((event) => {
      const target = event.targetFactionId;
      const conqueror =
        event.conquerorFactionId ??
        (typeof event.metadata?.conquerorFactionId === "string"
          ? event.metadata.conquerorFactionId
          : undefined);
      if (!target || target === faction.name || conqueror !== faction.name) return;
      const month = event.monthIndex ?? event.year;
      const key = `${target}:${event.historyGroupId ?? month}`;
      const current = collapseGroups.get(key);
      if (!current || event.type === "faction-extinct") collapseGroups.set(key, event);
    });

  const parentEndMonth = ruler.endYear ?? worldMonth;
  const predeceasedHeirCount = dynasty.rulers.filter((candidate) => {
    return Boolean(
      candidate.parentId === ruler.id &&
        candidate.reignOrdinal === undefined &&
        hasRecordedRulerDeath(candidate) &&
        candidate.deathMonth! >= accessionMonth && candidate.deathMonth! < parentEndMonth
    );
  }).length;

  const accessionSnapshot = start ?? {
    month: accessionMonth,
    population: 0,
    territoryShare: 0,
    cityCount: 0,
    stability: 0,
  };
  const finalSnapshot = end ?? accessionSnapshot;
  const peakPopulation = Math.max(accessionSnapshot.population, finalSnapshot.population, chronicle?.peakPopulation ?? 0);
  const peakTerritory = Math.max(accessionSnapshot.territoryShare, finalSnapshot.territoryShare, chronicle?.peakTerritoryShare ?? 0);
  const reignMonths = Math.max(0, endMonth - accessionMonth);
  const territorialPeakRetreat = Math.max(0, peakTerritory - finalSnapshot.territoryShare);
  const territorialPeakGain = peakTerritory - accessionSnapshot.territoryShare;
  const populationPeakRetreat = Math.max(0, peakPopulation - finalSnapshot.population);
  const populationPeakGain = peakPopulation - accessionSnapshot.population;
  const territoryDelta = finalSnapshot.territoryShare - accessionSnapshot.territoryShare;
  const populationDelta = finalSnapshot.population - accessionSnapshot.population;
  const cityDelta = finalSnapshot.cityCount - accessionSnapshot.cityCount;
  const stabilityDelta = finalSnapshot.stability - accessionSnapshot.stability;
  const accessionCrisis =
    accessionSnapshot.stability <= 45 ||
    (accessionSnapshot.cityCount <= 1 && accessionSnapshot.territoryShare <= 0.12);
  // LAST_RULER means the final holder at actual polity extinction, not every
  // deceased exile claimant or an administratively abdicated ruler.
  const laterAccession = dynasty.rulers.some(candidate => candidate.id !== ruler.id &&
    candidate.reignOrdinal !== undefined && candidate.accessionYear !== undefined && candidate.accessionYear >= endMonth &&
    (candidate.accessionYear > accessionMonth ||
      (ruler.reignOrdinal !== undefined && candidate.reignOrdinal > ruler.reignOrdinal)));
  const extinctionAtEnd = rulerEvents.some(event => event.type === "faction-extinct" &&
    event.targetFactionId === faction.name && (event.monthIndex ?? event.year) === endMonth);
  const ownTerminalCollapse = isFinalized && !laterAccession && ruler.status !== "abdicated" &&
    (extinctionAtEnd || ruler.endReason === "彻底灭亡" || ruler.endReason === "政治终结");
  const legacyEvidence = chronicle ? buildRulerLegacyEvidence(chronicle, accessionMonth, ruler.endYear, ruler.endReason, tenure.activeRuleMonths, {
    ...politicalStats, stateLosses: tenure.stateLossCount, exileMonths: tenure.exileMonths,
    restoredActiveRuleMonths: tenure.restoredActiveRuleMonths, terminalCollapse: ownTerminalCollapse,
    changedHouse: politicalFacts.some(f => f.usurpationRole === "USURPER"),
  }) : undefined;
  const trajectory = legacyEvidence?.trajectory ?? deriveRulerReignTrajectory({ ...createRulerChronicle(accessionSnapshot), endSnapshot: finalSnapshot,
    peakTerritoryShare: peakTerritory, peakPopulation },
    { ...politicalStats, activeRuleMonths: tenure.activeRuleMonths, exileMonths: tenure.exileMonths, stateLosses: tenure.stateLossCount });
  const expansion =
    finalSnapshot.territoryShare - accessionSnapshot.territoryShare >= 0.12 ||
    finalSnapshot.cityCount - accessionSnapshot.cityCount >= 3;
  const majorDecline =
    finalSnapshot.territoryShare - accessionSnapshot.territoryShare <= -0.12 ||
    finalSnapshot.cityCount - accessionSnapshot.cityCount <= -2 ||
    finalSnapshot.stability - accessionSnapshot.stability <= -25;
  const moderateRecovery =
    !expansion && !majorDecline && !ownTerminalCollapse &&
    finalSnapshot.territoryShare - accessionSnapshot.territoryShare >= 0.05 &&
    finalSnapshot.population - accessionSnapshot.population >= Math.max(3, accessionSnapshot.population * 0.5) &&
    finalSnapshot.stability - accessionSnapshot.stability >= 10;
  const roles: HistoricalRole[] = [];
  if (foundedFaction || foundedState) roles.push("FOUNDER");
  if (proclaimedEmperor) roles.push("IMPERIAL_FOUNDER");
  if (restorationCount > 0) roles.push("RESTORER");
  if (completedUnification) roles.push("UNIFIER");
  if (expansion) roles.push("EXPANDER");
  if ((chronicle?.citiesCapturedPersonally ?? 0) >= 2 || collapseGroups.size > 0) roles.push("CONQUEROR");
  if (
    tenure.activeRuleMonths >= 18 * 12 && trajectory.quietStewardshipEligible && legacyEvidence?.stableGovernanceEligible &&
    !majorDecline && !tenure.lostStateDuringTenure && !expansion &&
    Math.abs(territoryDelta) < 0.12 && cityDelta <= 2
  ) roles.push("STEWARD");
  if (accessionCrisis && !ownTerminalCollapse) roles.push("CRISIS_SURVIVOR");
  if (trajectory.expandedThenRetreated) roles.push("PEAK_AND_RETREAT");
  if (trajectory.inheritedDecline) roles.push("INHERITED_HIGH_DECLINE");
  if (moderateRecovery) roles.push("MODERATE_RECOVERY");
  if (
    tenure.activeRuleMonths >= 30 * 12 &&
    (chronicle?.citiesLostDuringReign ?? 0) >= 6 &&
    (chronicle?.citiesCapturedPersonally ?? 0) >= 2 &&
    territoryDelta > -0.12 &&
    !majorDecline && !trajectory.majorTerritoryRetreat &&
    !ownTerminalCollapse
  ) roles.push("CONTESTED_REIGN");
  if (majorDecline) roles.push("DECLINER");
  if (ownTerminalCollapse) roles.push("LAST_RULER");
  if (tenure.totalTenureMonths <= 5 * 12) roles.push("SHORT_REIGN");
  if (["战死", "被俘处死"].includes(ruler.endReason ?? "")) roles.push("TRAGIC_RULER");
  if (tenure.exiledAtAccession || tenure.exileMonths > 0) roles.push("EXILED_RULER");
  if (tenure.exileMonths >= 5 * 12 && tenure.exileMonths > tenure.activeRuleMonths) roles.push("LONG_EXILE");
  if (tenure.restoredDuringTenure && tenure.exileEpisodeCount > 0) roles.push("RESTORED_FROM_EXILE");

  const accessionAge = ruler.bornYear !== undefined
    ? Math.floor(monthsToYears(accessionMonth - ruler.bornYear))
    : undefined;
  const finalAge = ruler.bornYear !== undefined
    ? Math.floor(monthsToYears((hasRecordedRulerDeath(ruler) ? ruler.deathMonth! : endMonth) - ruler.bornYear))
    : undefined;

  return {
    trajectory,
    rulerId: ruler.id,
    factionId: faction.name,
    accessionAge,
    finalAge,
    hasRecordedDeath: hasRecordedRulerDeath(ruler),
    reignMonths,
    tenure,
    isFinalized,
    rulerStatus: ruler.status,
    deathMonth: hasRecordedRulerDeath(ruler) ? ruler.deathMonth : undefined,
    deathReason: hasRecordedRulerDeath(ruler) ? ruler.deathReason : undefined,
    foundedFaction,
    foundedState,
    formalStateAtReignEnd,
    foundedStateName,
    monthsSinceStateFoundationAtEnd,
    monthsSinceFactionFoundationAtEnd,
    proclaimedEmperor,
    completedUnification,
    restorationCount,
    observedPeakCityCount: Math.max(...[start, chronicle?.latestSnapshot, chronicle?.endSnapshot].filter(Boolean).map(s => s!.cityCount), 0),
    startPopulation: accessionSnapshot.population,
    endPopulation: finalSnapshot.population,
    peakPopulation,
    startTerritory: accessionSnapshot.territoryShare,
    endTerritory: finalSnapshot.territoryShare,
    peakTerritory,
    startCityCount: accessionSnapshot.cityCount,
    endCityCount: finalSnapshot.cityCount,
    startStability: accessionSnapshot.stability,
    endStability: finalSnapshot.stability,
    personalCityCaptures: chronicle?.citiesCapturedPersonally ?? 0,
    citiesLost: chronicle?.citiesLostDuringReign ?? 0,
    rebellions: chronicle?.rebellionsDuringReign ?? 0,
    deathCause: chronicle?.deathCause,
    endReason: ruler.endReason,
    forcedCapitalRelocationsDuringReign: capitalRelocations.length,
    directlyAttributedCapitalRelocations,
    factionsDestroyedByFactionDuringReign: politicalStats.nationalExtinctions,
    factionsDestroyedDirectlyAttributedToRuler: politicalStats.personalExtinctions,
    predeceasedHeirCount,
    territorialPeakRetreat,
    territorialPeakGain,
    populationPeakRetreat,
    populationPeakGain,
    territoryDelta,
    populationDelta,
    cityDelta,
    stabilityDelta,
    stableGovernanceEligible: legacyEvidence?.stableGovernanceEligible ?? false,
    longStableReign: legacyEvidence?.longStableReign ?? false,
    governanceCost: legacyEvidence?.governanceCost ?? false,
    accessionCrisis,
    terminalCollapse: ownTerminalCollapse,
    roles,
    politicalFacts,
  };
}

function describeRulerExileEnding(evidence: RulerHistoricalEvidence, historian = false) {
  if (evidence.tenure.lostStateDuringTenure) {
    return evidence.terminalCollapse
      ? "失国与政治终结均发生于其承统期间，二者时间有别；发生于任内，不等于由其个人造成。"
      : "失国发生于其任内；任期结束不等于国家政治终结，个人责任亦须另有证据。";
  }
  return evidence.tenure.exiledAtAccession
    ? evidence.terminalCollapse ? `失国早于其继位，所承为无土王统；王统${historian ? "" : "政治"}终结于其任内，不能将此前失国归作其在位事件。` : "失国早于其继位，流亡承统年限不能代作在国治绩。"
    : evidence.terminalCollapse ? "政治终结发生于其任内；失国起点缺少明确记录，不据终局推定个人责任。" : "流亡经历与个人责任分别记载，任期结束不等于国家终结。";
}

function composeLegacyRulerAssessment(evidence: RulerHistoricalEvidence): RulerAssessment {
  const lines: string[] = [];
    const usurpation = evidence.politicalFacts.find((fact) => fact.type === "dynasty-usurped" && fact.usurpationRole === "USURPER");
  const deposition = evidence.politicalFacts.find((fact) => fact.type === "ruler-deposed" && fact.depositionRole);
  const abdicated = evidence.rulerStatus === "abdicated";
  const finalTime = evidence.isFinalized ? (evidence.hasRecordedDeath ? "身后" : abdicated ? "退位时" : "政治任期终结时") : "目前";
  const nonDeathFinal = !evidence.hasRecordedDeath;
  const livingPrefix = evidence.isFinalized ? "" : "截至目前，";
  const childAccession = evidence.accessionAge !== undefined && evidence.accessionAge <= 11;
  const youthAccession = evidence.accessionAge !== undefined && evidence.accessionAge >= 12 && evidence.accessionAge <= 15;
  const agePrefix = childAccession ? "幼年承统，" : youthAccession ? "少年即位，" : "";

  if (evidence.roles.includes("RESTORED_FROM_EXILE")) {
    lines.push(`亡国流亡${formatWorldDuration(evidence.tenure.restoredExileMonths)}后恢复国家，复国成为其${evidence.isFinalized ? (nonDeathFinal ? "承统经历中" : "一生") : "截至目前"}最重要的历史转折。`);
    if (evidence.tenure.exileMonths > evidence.tenure.restoredExileMonths) {
      lines.push(`其后仍有流亡经历，累计流亡${formatWorldDuration(evidence.tenure.exileMonths)}。`);
    }
    return { heading: evidence.isFinalized ? "史评" : "在位评议", evidence, lines };
  }
  if (evidence.roles.includes("LONG_EXILE")) {
    if (evidence.tenure.exiledAtAccession && evidence.tenure.activeRuleMonths === 0) {
      const exileAccession = childAccession ? "幼年承接流亡王统" : youthAccession ? "少年承接流亡王统" : "承接流亡王统";
      lines.push(`${exileAccession}，${evidence.isFinalized ? "全部承统岁月" : "截至目前的全部承统岁月"}均在流亡中度过，没有在国治理时期。`);
      lines.push("其身份是流亡王统的承接者，不能将承统年限视为在国治绩。");
    } else if (evidence.tenure.lostStateDuringTenure && (evidence.tenure.monthsUntilFirstExile ?? Infinity) <= 12) {
      lines.push(evidence.isFinalized
        ? (nonDeathFinal ? `即位不久即失去国土，此后王室长期流亡，至${finalTime}未能复国。` : "即位不久即失去国土，此后王室长期流亡，终其一生未能复国。")
        : "即位不久即失去国土，此后王室长期流亡；截至目前尚未复国。");
    } else if (evidence.tenure.diedInExile) {
      lines.push(`承统期间曾失去国土，其后长期流亡，累计流亡${formatWorldDuration(evidence.tenure.exileMonths)}，未能复国。`);
    } else {
      lines.push(`在位期间历经流亡，流亡${formatWorldDuration(evidence.tenure.exileMonths)}；在国治理时间为${formatWorldDuration(evidence.tenure.activeRuleMonths)}。`);
    }
    if (evidence.terminalCollapse) lines.push(describeRulerExileEnding(evidence));
    return { heading: evidence.isFinalized ? "史评" : "在位评议", evidence, lines: lines.slice(0, 4) };
  }

  if (usurpation) {
    const replacedHouse = usurpation.oldHouseName ? `${usurpation.oldHouseName}王统` : "前王统";
    const newHouse = usurpation.newHouseName ? `${usurpation.newHouseName}王统` : "新王统";
    const displaced = usurpation.displacedSuccessorName ? `，排除合法继承人${usurpation.displacedSuccessorName}` : "";
    const nameChange = usurpation.oldStateName && usurpation.newStateName && usurpation.oldStateName !== usurpation.newStateName
      ? `，国号由${usurpation.oldStateName}改为${usurpation.newStateName}` : "";
    lines.push(`${livingPrefix}其以篡朝方式夺取王统，${newHouse}取代${replacedHouse}${displaced}${nameChange}。`);
  } else if (deposition?.depositionRole === "DEPOSED_RULER") {
    if(deposition.politicalNarrative)lines.push(deposition.politicalNarrative);else lines.push(`${livingPrefix}其在位末期被宗室${deposition.relatedRulerName ?? "成员"}废黜；废位本身不证明其失地或其他危局就是废立原因。`);
  } else if (deposition?.depositionRole === "DEPOSING_SUCCESSOR") {
    if(deposition.politicalNarrative)lines.push(deposition.politicalNarrative);else lines.push(`${livingPrefix}其在前君仍在世时经宗室废立取得君位；这一政治身份与其后任内治绩应分别考察。`);
  } else if (evidence.foundedState) {
    lines.push(`${livingPrefix}${agePrefix}其开创之功在于正式建国${evidence.foundedStateName ? evidence.foundedStateName === "王" ? "、确立王国的统治基础" : `、奠定${evidence.foundedStateName}国统` : "，使政权成为正式国家"}。`);
  } else if (evidence.foundedFaction) {
    lines.push(`${livingPrefix}${agePrefix}其创立势力、开其端绪，为后来政权留下政治前身。`);
  } else if (evidence.proclaimedEmperor) {
    lines.push(`${livingPrefix}${agePrefix}其称帝完成了本朝由王权到帝制的关键转折。`);
  } else if (evidence.restorationCount > 0) {
    lines.push(`${livingPrefix}${agePrefix}复国与重建王统，是其最突出的历史功业。`);
  } else if (evidence.completedUnification) {
    lines.push(`${livingPrefix}${agePrefix}完成天下统一，使其历史地位超出一国兴替。`);
  } else if (evidence.accessionCrisis && evidence.roles.includes("EXPANDER")) {
    const accessionPhrase = childAccession ? "幼年继任时" : youthAccession ? "少年继位时" : "承统之初";
    lines.push(`${livingPrefix}${accessionPhrase}国势未固，其后疆域显著扩展，由危局转入进取。`);
  } else if (evidence.terminalCollapse && evidence.accessionCrisis) {
    lines.push(`${agePrefix}其时国势已陷危局${evidence.startCityCount === 1 ? "，仅据孤城" : evidence.startCityCount === 0 ? "，承统之际已无城土" : ""}，并非由盛转衰的始作俑者。`);
  } else if (evidence.roles.includes("CRISIS_SURVIVOR") && !evidence.roles.includes("EXPANDER")) {
    const accessionPhrase = childAccession ? "幼年继任" : youthAccession ? "少年继位" : "临危承统";
    lines.push(`${livingPrefix}${accessionPhrase}，其时政权尚处危局；主要考验在于维系既有政权。`);
  } else if (
    evidence.roles.includes("DECLINER") &&
    evidence.endStability >= 75 && evidence.stabilityDelta > 0 &&
    (evidence.territoryDelta <= -0.12 || evidence.cityDelta <= -2)
  ) {
    lines.push("国日蹙而城仅存，末期残余核心虽稳，终未能复其旧势。");
  } else if (evidence.roles.includes("INHERITED_HIGH_DECLINE")) {
    lines.push(`${livingPrefix}承统时国势已居高位，其后疆域显著回落，未能维持前期盛势。`);
  } else if (evidence.roles.includes("MODERATE_RECOVERY")) {
    lines.push(`${livingPrefix}其在位未形成决定性扩张，但人口、疆域与稳定均有所恢复，治绩更近恢复而非开创。`);
  } else if (evidence.roles.includes("PEAK_AND_RETREAT")) {
    lines.push(`${livingPrefix}其治下疆域由${formatPercent(evidence.startTerritory)}升至记录峰值${formatPercent(evidence.peakTerritory)}，其后大幅回落，不能仅以首末接近视为守成。`);
  } else if (evidence.roles.includes("EXPANDER")) {
    lines.push(`${livingPrefix}${agePrefix}其治下国势显著开拓，可称一代进取之主；其政治遗产以拓境为重。`);
  } else if (evidence.roles.includes("STEWARD")) {
    lines.push(`${livingPrefix}其治下少有显著拓境，长久维持政权与秩序，守成为其主要遗产。`);
  } else if (evidence.roles.includes("SHORT_REIGN") && !hasMajorLegacy(evidence)) {
    lines.push(`${livingPrefix}承统不超过五年，现有史实尚不足以形成明确的治绩判断。`);
  } else if (evidence.roles.includes("LAST_RULER")) {
    lines.push(`${agePrefix}国家终结于其承统末期，属于最终政治终结时的末代君主。`);
  } else {
    lines.push(`${livingPrefix}${agePrefix}现有记录未见足以改写政权格局的突出功业。`);
  }

  if (evidence.completedUnification && !lines.some((line) => line.includes("天下统一"))) {
    lines.push("其统一天下之功，确立了此后历史叙述的分界。 ".trim());
  } else if (evidence.factionsDestroyedDirectlyAttributedToRuler > 0) {
    lines.push(`有明确亲征记录显示，其直接参与攻灭${evidence.factionsDestroyedDirectlyAttributedToRuler}个政权。`);
  } else if (evidence.factionsDestroyedByFactionDuringReign > 0) {
    lines.push(`其治下先后覆灭${evidence.factionsDestroyedByFactionDuringReign}个政权，扩张不止于城邑得失。`);
  } else if (evidence.roles.includes("EXPANDER") && !evidence.foundedState && !evidence.completedUnification) {
    const polity = evidence.formalStateAtReignEnd ? "国家" : "势力";
    lines.push(`其疆域一度达到${formatPercent(evidence.peakTerritory)}，开拓使${polity}${getTerritorialScaleJudgement(evidence.peakTerritory)}。`);
  }

  const stableDeclineSummary = evidence.roles.includes("DECLINER") && evidence.endStability >= 75 && evidence.stabilityDelta > 0 &&
    (evidence.territoryDelta <= -0.12 || evidence.cityDelta <= -2);
  if (usurpation && (evidence.territoryDelta <= -0.08 || evidence.cityDelta <= -1 || evidence.stabilityDelta !== 0)) {
    const changes = [`疆域由${formatPrecisePercent(evidence.startTerritory)}至${formatPrecisePercent(evidence.endTerritory)}`,
      `城市${evidence.startCityCount}座至${evidence.endCityCount}座`];
    if (evidence.startStability !== evidence.endStability) changes.push(`稳定度${evidence.startStability}至${evidence.endStability}`);
    lines.push(`其任内国家结果为${changes.join("，")}；这是在位变化的记录，不足以证明由夺统所致。`);
  } else if (!usurpation && stableDeclineSummary) {
    lines.push(`疆域由${formatPercent(evidence.startTerritory)}降至${formatPercent(evidence.endTerritory)}，城市由${evidence.startCityCount}座减至${evidence.endCityCount}座；稳定度由${evidence.startStability}升至${evidence.endStability}。`);
  } else if (!usurpation && evidence.territorialPeakRetreat >= 0.15) {
    if (evidence.territorialPeakGain >= 0.08) {
      lines.push(`其治下疆域一度达到${formatPercent(evidence.peakTerritory)}${evidence.peakTerritory >= 0.3 ? "，一度跻身天下强权" : ""}，至${finalTime}已明显回落，盛势未能维持。`);
    } else if (evidence.startTerritory >= 0.3 || evidence.territoryDelta <= -0.12) {
      const residualCoreStable = evidence.endStability >= 75 && evidence.stabilityDelta > 0;
      lines.push(`承统时疆域已有${formatPercent(evidence.startTerritory)}，其后明显收缩${residualCoreStable ? "；末期残存核心虽稳，终未能复其旧势" : `，至${finalTime}回落至${formatPercent(evidence.endTerritory)}`}。`);
    } else {
      lines.push(`疆域一度达到${formatPercent(evidence.peakTerritory)}，至${finalTime}已明显回落。`);
    }
  } else if (
    evidence.populationPeakGain >= Math.max(3, evidence.startPopulation * 0.25) &&
    evidence.populationPeakRetreat >= Math.max(8, evidence.peakPopulation * 0.35)
  ) {
    lines.push(`人口一度达到${evidence.peakPopulation}，至${finalTime}明显回落，盛势未能转化为稳定基础。`);
  } else if ((evidence.governanceCost || hasGovernanceCost(evidence)) && evidence.roles.includes("EXPANDER")) {
    lines.push(evidence.startPopulation > 0 && evidence.endPopulation <= evidence.startPopulation * 0.6
      ? "开拓伴随明显代价，可谓得地而失民；人口与稳定的承受能力未能同步。"
      : "其功在开拓，但稳定度明显下滑，扩张成果伴随沉重的治理代价。");
  } else if (
    evidence.startPopulation > 0 &&
    evidence.populationPeakGain < Math.max(3, evidence.startPopulation * 0.25) &&
    evidence.startPopulation - evidence.endPopulation >= Math.max(5, evidence.startPopulation * 0.35)
  ) {
    lines.push(`承统时人口已有${evidence.startPopulation}，至${finalTime}降至${evidence.endPopulation}。`);
  } else if (evidence.forcedCapitalRelocationsDuringReign >= 2) {
    lines.push(`在位期间两度失都，王室被迫迁徙${evidence.rebellions > 0 ? "，又屡经内乱" : ""}；` +
      (evidence.terminalCollapse ? "最终未能保全国祚。" : "政权仍得以延续。"));
  } else if (evidence.rebellions > 0) {
    lines.push(`${evidence.rebellions >= 2 ? "其治下内乱频仍" : "其治下发生重大内乱"}，政权承受了持续的内部压力${evidence.terminalCollapse ? "，终亡于其世" : "，但国统仍得延续"}。`);
  } else if (evidence.predeceasedHeirCount > 0) {
    const successionLoss = !evidence.hasRecordedDeath
      ? `在位期间有${evidence.predeceasedHeirCount}名继承候选去世，继承秩序因此受到冲击。`
      : formatPredeceasedHeirAssessment(evidence.predeceasedHeirCount);
    if (successionLoss) lines.push(successionLoss);
  }

  if (evidence.terminalCollapse && !evidence.accessionCrisis) {
    lines.push(describeRulerExileEnding(evidence));
  } else if (evidence.terminalCollapse && evidence.accessionCrisis) {
    lines.push(`承统时已见危局；${describeRulerExileEnding(evidence)}`);
  } else if (evidence.deathCause === "战死" && evidence.foundedState) {
    lines.push(evidence.monthsSinceStateFoundationAtEnd !== undefined && evidence.monthsSinceStateFoundationAtEnd <= FOUNDING_EARLY_DEATH_MAX_MONTHS
      ? "正式建国未久即身死军中。"
      : "最终身死军中。");
  } else if (evidence.deathCause === "战死" && evidence.foundedFaction) {
    lines.push(evidence.monthsSinceFactionFoundationAtEnd !== undefined && evidence.monthsSinceFactionFoundationAtEnd <= FOUNDING_EARLY_DEATH_MAX_MONTHS
      ? "创立势力未久即身死军中。"
      : "最终身死军中。");
  } else if (evidence.deathCause === "战死" && hasMajorLegacy(evidence)) {
    lines.push("功业未竟而身死军中，留下的事业仍有未竟之处。");
  } else if (!usurpation && !stableDeclineSummary && (
    evidence.roles.includes("DECLINER") && !evidence.roles.includes("PEAK_AND_RETREAT") &&
    !lines.some((line) => line.includes("终未能复其旧势"))
  )) {
    lines.push("国势在其任内显著衰退，主要遗产因而蒙上阴影。");
  }

  if (evidence.roles.includes("EXILED_RULER") && lines.length < 4) {
    lines.push(`其承统期间曾流亡${formatWorldDuration(evidence.tenure.exileMonths)}${evidence.tenure.restoredDuringTenure ? "，其后复国" : ""}。`);
  }

  return {
    heading: evidence.isFinalized ? "史评" : "在位评议",
    evidence,
    lines: uniqueLines(lines).slice(0, 4),
  };
}

/** Compose the assessment from separate identity, tenure result, major events and ending dimensions. */
export function composeRulerAssessment(evidence: RulerHistoricalEvidence): RulerAssessment {
  const legacy = composeLegacyRulerAssessment(evidence);
  const deposition = evidence.politicalFacts.find((fact) => fact.type === "ruler-deposed" && fact.depositionRole);
  const lines = [...legacy.lines];
  if (evidence.tenure.restoredDuringTenure) {
    lines.splice(0, lines.length,
      `${evidence.tenure.exiledAtAccession ? "承统之际已失城土，继承流亡王统" : "任内曾失去城土"}，其后实际复国${evidence.restorationCount}次${evidence.restorationCount === 1 ? `，流亡${formatWorldDuration(evidence.tenure.restoredExileMonths)}后恢复国家` : ""}。`,
      `承统${formatWorldDuration(evidence.reignMonths)}，其中在国治理${formatWorldDuration(evidence.tenure.activeRuleMonths)}、流亡${formatWorldDuration(evidence.tenure.exileMonths)}${evidence.endCityCount === 0 ? "；任期末再次无城土" : ""}。`);
  }
  if (evidence.trajectory.expandedThenRetreated || evidence.trajectory.inheritedDecline) {
    const prefix = evidence.trajectory.inheritedDecline ? "承统时国势已居高位；" : "";
    const summary = `${prefix}疆域即位${formatPrecisePercent(evidence.startTerritory)}→记录峰值达到${formatPrecisePercent(evidence.peakTerritory)}→终局${formatPrecisePercent(evidence.endTerritory)}，明显回落${evidence.citiesLost ? `，失城记录${evidence.citiesLost}次（非净损失）` : ""}${evidence.hasRecordedDeath ? "；身后评议须兼看过程与终局" : ""}。`;
    const peakSentence = (line: string) => /记录峰值|承统时国势已居高位|疆域.*一度|疆域一度|承统时疆域已有|^疆域由.*城市由/.test(line);
    if (evidence.tenure.restoredDuringTenure) lines[1] += summary;
    else {
      const existing = lines.findIndex(peakSentence);
      for (let i = lines.length - 1; i >= 0; i--) if (peakSentence(lines[i])) lines.splice(i, 1);
      lines.splice(existing >= 0 ? Math.min(existing, lines.length) : Math.min(1, lines.length), 0, summary);
    }
  }

  const conflictingScale = evidence.territoryDelta * evidence.cityDelta < 0;
  if (conflictingScale && !lines.some((line) => line.includes(formatPrecisePercent(evidence.startTerritory)) && line.includes(formatPrecisePercent(evidence.endTerritory)))) {
    const changes: string[] = [];
    if (Math.abs(evidence.territoryDelta) >= 0.02) changes.push(`疆域占比由${formatPrecisePercent(evidence.startTerritory)}${evidence.territoryDelta > 0 ? "升" : "降"}至${formatPrecisePercent(evidence.endTerritory)}`);
    if (evidence.cityDelta !== 0) changes.push(`城市由${evidence.startCityCount}座${evidence.cityDelta > 0 ? "增" : "减"}至${evidence.endCityCount}座`);
    if (Math.abs(evidence.stabilityDelta) >= 12) changes.push(`稳定度由${evidence.startStability}${evidence.stabilityDelta > 0 ? "升" : "降"}至${evidence.endStability}`);
    if (Math.abs(evidence.populationDelta) >= Math.max(5, evidence.startPopulation * 0.2)) changes.push(`人口由${evidence.startPopulation}${evidence.populationDelta > 0 ? "增" : "减"}至${evidence.endPopulation}`);
    const metrics = `任期记录显示${changes.join("，")}；这些变化说明国势结果，不单独证明个人行为或因果。`;
    if (lines.length >= 4) {
      const replaceIndex = lines.findIndex((line, index) => index > 0 && /现有记录未见|不能据此|如何维系|尚不足|无法证明/.test(line));
      lines.splice(replaceIndex > 0 ? replaceIndex : 1, 1);
    }
    lines.splice(Math.min(1, lines.length), 0, metrics);
  }

  const facts = evidence.politicalFacts.filter((fact) => fact.suitableForAssessment);
  const nationalStats = summarizeRulerPoliticalFacts(facts);
  const directCaptures = facts.filter((fact) => ["city-captured", "city-recovered", "capital-fallen"].includes(fact.type) && fact.role === "DIRECT_ACTOR");
  const directCapitalCaptures = directCaptures.filter((fact) => fact.wasCapital);
  const terminalAttacks = facts.filter((fact) => fact.terminalOutcome && fact.militaryRole === "ATTACKER");
  const groupedTerminal = terminalAttacks.filter((fact) => !fact.historyGroupId ||
    !directCaptures.some((capture) => capture.historyGroupId === fact.historyGroupId));
  const eventLines: string[] = [];
  if (directCaptures.length) {
    eventLines.push(`有本人行动记录的攻城共${directCaptures.length}次${directCapitalCaptures.length ? `，其中攻陷当时都城${directCapitalCaptures.length}次` : ""}。`);
  }
  if (!directCaptures.length && nationalStats.nationalCapitalCaptures) eventLines.push(`其治下攻陷当时敌都${nationalStats.nationalCapitalCaptures}次，未见可归为本人亲征的行动证据。`);
  if (groupedTerminal.length) {
    const count = (outcome: RulerPoliticalFact["terminalOutcome"]) => groupedTerminal.filter((fact) => fact.terminalOutcome === outcome).length;
    const parts = [count("EXTINCT") ? `正式政权灭亡${count("EXTINCT")}个` : "", count("DISSOLVED") ? `残部解散${count("DISSOLVED")}个` : "", count("EXILED") ? `政权流亡${count("EXILED")}个` : ""].filter(Boolean);
    eventLines.push(`任内与本国军事行动相关的结果包括${parts.join("、")}；这些终局彼此有别。`);
  }
  const signedAgreements = facts.filter((fact) => fact.role === "DIRECT_ACTOR" && ["truce-signed", "non-aggression-signed", "alliance-signed"].includes(fact.type));
  if (signedAgreements.length) eventLines.push(`可核实的本人外交签署记录共${signedAgreements.length}项；签约本身不等同于外交成效。`);
  const successionFacts = facts.filter((fact) => fact.type === "heir-died");
  if (successionFacts.length) eventLines.push(`任内有${successionFacts.length}名继承候选先于其去世；现有记录不足以证明其已正式立储。`);
  const nationalCrises = facts.filter((fact) => fact.role === "IN_TENURE" && ["capital-fallen", "capital-relocated", "empire-split"].includes(fact.type));
  if (nationalCrises.length) eventLines.push(`任内另有${nationalStats.crisisEpisodes}组可核实的失都、迁都、失国或国家分裂经历，同一历史过程合并看待。`);
  const selectedEvent = eventLines.find((line) => !lines.some((existing) => existing.includes(line.slice(0, 12))));
  if (selectedEvent && lines.length < 4) lines.push(selectedEvent);

  if (evidence.hasRecordedDeath && evidence.deathMonth !== undefined) {
    const death = `${evidence.tenure.diedInExile ? "流亡期间于" : ""}${formatWorldDate(evidence.deathMonth)}${evidence.deathReason === "战死" ? "战死" : evidence.deathReason === "被俘处死" ? "被俘处死" : "去世"}${evidence.finalAge !== undefined ? `，享年${evidence.finalAge}岁` : ""}。`;
    if (!lines.some((line) => line.includes(formatWorldDate(evidence.deathMonth!)))) {
      if (lines.length >= 4) lines[lines.length - 1] = death;
      else lines.push(death);
    }
  } else if (deposition?.depositionRole === "DEPOSED_RULER") {
    if (lines.length < 4) lines.push("废位仅终结其君主任期；没有真实死亡记录时，不推定其生命结局。");
  } else {
    const other = legacy.lines.find((line) => !lines.includes(line) && (!evidence.tenure.restoredDuringTenure || !/复国|恢复国家|流亡/.test(line)) && !/疆域|城市|稳定度|人口|治下|在位期间|终结|身死|死亡/.test(line));
    if (other && !lines.includes(other) && lines.length < 4) lines.push(other);
  }
  return { heading: evidence.isFinalized ? "史评" : "在位评议", evidence, lines: uniqueLines(lines).slice(0, 4) };
}

export function deriveRulerAssessment(context: RulerHistoriographyContext) {
  return composeRulerAssessment(deriveRulerPresentationEvidence(context));
}

/** A compact, deterministic final judgement, derived only from recorded outcomes. */
export function composeHistorianVoice(evidence: RulerHistoricalEvidence): string | undefined {
  if (!evidence.isFinalized) return undefined;
  const pick = (lines: string[]) => {
    const text = lines[stableHash(evidence.rulerId) % lines.length];
    return !evidence.hasRecordedDeath
      ? text.replaceAll("身后", evidence.rulerStatus === "abdicated" ? "退位时" : "政治任期终结时").replaceAll("其一生", "其承统期间").replaceAll("一生治绩", "在位治绩")
      : text;
  };
  const roles = evidence.roles;
  const usurpation = evidence.politicalFacts.find((fact) => fact.type === "dynasty-usurped" && fact.usurpationRole === "USURPER");
  const deposition = evidence.politicalFacts.find((fact) => fact.type === "ruler-deposed" && fact.depositionRole);

  if (evidence.tenure.restoredDuringTenure) {
    const lasting = evidence.tenure.restoredActiveRuleMonths >= 10 * 12;
    return `其${evidence.restorationCount > 1 ? "屡复故国" : "恢复故国"}，${lasting ? "复国后的在国治理亦有年月可考" : "惟在国治理短促，恢复尚未稳固"}；${evidence.terminalCollapse ? "政权终于其世，复国与国难当并记" : evidence.tenure.diedInExile ? "末年流亡虽是其结局，却不足以抹去此前恢复国统之事" : "复国之功与此后能否守成，应合观而不偏废"}。`;
  }
  if (usurpation) {
    const displaced = usurpation.displacedSuccessorName ? "并排除原合法继承人" : "";
    if (evidence.territoryDelta <= -0.08 || evidence.cityDelta <= -1) {
      return `其以篡朝方式改变王统${displaced}；任内疆域由${formatPrecisePercent(evidence.startTerritory)}变为${formatPrecisePercent(evidence.endTerritory)}、城市由${evidence.startCityCount}座变为${evidence.endCityCount}座。现有记录只证明两者同在其任期，不能据此断定因果。`;
    }
    if (evidence.territoryDelta >= 0.12 || evidence.cityDelta >= 2) {
      return `其以篡朝方式改变王统${displaced}，任内疆域由${formatPrecisePercent(evidence.startTerritory)}变为${formatPrecisePercent(evidence.endTerritory)}、城市由${evidence.startCityCount}座增至${evidence.endCityCount}座；夺统身份与治理结果各有其事实依据。`;
    }
    return `其以篡朝方式取得王统，改变了政治承统关系；现有任期记录未显示足以将这一身份直接等同于治绩的依据。`;
  }

  if (deposition?.depositionRole === "DEPOSED_RULER") {
    const laterDeath = evidence.hasRecordedDeath && evidence.endReason === "被废";
    const outcome = evidence.territoryDelta > 0.05 ? "任内疆域有所扩展" : evidence.territoryDelta < -0.05 ? "任内疆域有所收缩" : "任内疆域变化有限";
    const ending = laterDeath && evidence.deathMonth !== undefined
      ? `，于${formatWorldDate(evidence.deathMonth)}真实去世`
      : "";
    if(deposition.politicalCause)return `${deposition.politicalCause}其在位末期遭宗室废立${ending}；废位后的生命结局仍据本人记录。`;
    return `其在位末期遭宗室废立，废位后${laterDeath ? "仍继续生存，后来才有真实死亡记录" : "的生死依实际记录另行判断"}；${outcome}${ending}。王位易手与国势变化均可考，但不足以证明前者由后者造成。`;
  }
  if (deposition?.depositionRole === "DEPOSING_SUCCESSOR") {
    const result = evidence.territoryDelta > 0.05 || evidence.cityDelta > 0 ? "有所扩展" :
      evidence.territoryDelta < -0.05 || evidence.cityDelta < 0 ? "有所收缩" : "变化有限";
    const ending = evidence.hasRecordedDeath
      ? evidence.deathReason === "战死" ? "，最终战死" : evidence.deathMonth !== undefined ? `，后于${formatWorldDate(evidence.deathMonth)}去世` : ""
      : "";
    return `其在前君仍在世时经宗室废立取得君位；任内国势${result}${ending}。夺位身份、统治结果与生命结局各有其据，不以其一推定其余。`;
  }

  if (roles.includes("FOUNDER") && roles.includes("EXPANDER") && evidence.governanceCost && evidence.foundedState) return pick([
    "开国与拓境并见，国家规模由此扩大；人口或稳定所见的治理代价，亦不可略。",
    "其功在开创，亦在拓土；然而人口与稳定的变化显示，功业之外尚有治理代价。",
    "创业与开拓皆有实绩，国家规模因之而变；功业与可见代价并存。",
    "正式建国并持续拓境，留下开创之功；人口或稳定的变化也记录了治理代价。",
    "其奠国与拓土之绩可考，同时期人口或稳定承压，功与代价皆应记取。",
  ]);
  if (roles.includes("FOUNDER") && roles.includes("EXPANDER") && evidence.governanceCost) return pick([
    "其创立势力并有所拓境；人口或稳定的变化亦显示草创时期的治理代价。",
    "草创势力与开拓之绩并见，人口或稳定所见的代价也不应略去。",
    "创立本政权前身并推动拓境，所见功业与可考治理代价并存。",
    "其举事开其端绪，继而拓境；人口或稳定变化留下了治理承压的证据。",
    "势力由其创立且疆域有所拓展，同时也可见人口或稳定方面的代价。",
  ]);
  if (roles.includes("FOUNDER") && roles.includes("EXPANDER") && evidence.foundedState) return pick([
    "创业而兼拓土，新邦由此迅速壮大；其功在奠基，亦在开疆。",
    "开国之后即见拓境之绩，国家规模由此形成。",
    "其先奠政权之基，继而拓展疆土，开创与开疆皆有实绩。",
    "国家由其开创，疆域亦在其任内扩大，创业与拓展相互映照。",
    "建国确立政权起点，拓土则扩大其规模，两项功业皆有事实可据。",
  ]);
  if (roles.includes("FOUNDER") && roles.includes("EXPANDER")) return pick([
    "创立势力而兼有拓境之绩，草创的政治基础由此扩大。",
    "其创建本政权前身，任内又见疆域拓展，势力规模因而增长。",
    "举事开其端绪，随后拓土；势力创始与疆域扩展皆可见于史实。",
    "其创立势力并推动拓境，为后来国家留下政治起点与版图基础。",
    "草创势力之后又有所开拓，所见是一个政权前身逐步扩大的过程。",
  ]);
  if (roles.includes("EXPANDER") && evidence.governanceCost) return pick([
    "疆域拓展有实绩，人口或稳定亦承受代价；得地与失衡并见，功过不宜偏举。",
    "其功在进取，其患亦随扩张而生；所拓之土虽可考，维系之难同样见于史实。",
    "开拓改变了国家版图，却未能使治理代价消隐；其历史分量正在功与患并存。",
    "疆域有所拓展，人口或稳定却出现明确损耗；开拓成果与治理代价并存。",
    "其拓境之功可见，人口或稳定的下行也有记录；两面皆是其统治遗产。",
  ]);
  if (evidence.trajectory.recoveredAfterWarfare && !roles.includes("CONTESTED_REIGN")) {
    return "其任内城邑反复得失，末期城市与疆域已恢复至接近即位规模；这是战乱后的恢复，不宜写作全程无事的守成。";
  }
  if (roles.includes("CONTESTED_REIGN")) {
    const duration = formatWorldDuration(evidence.tenure.activeRuleMonths);
    const territory = `${formatPrecisePercent(evidence.startTerritory)}至${formatPrecisePercent(evidence.endTerritory)}`;
    return pick([
      `${duration}间失城${evidence.citiesLost}座，亦曾亲征夺城${evidence.personalCityCaptures}座；疆域${territory}，其世更见长期争衡，而非单向崩解。`,
      `在位${duration}，失城${evidence.citiesLost}座而亲征夺城${evidence.personalCityCaptures}座；国土仍由${territory}，胜负反复，难以一言概括。`,
      `${duration}的统治中，失城与亲征所得并存（${evidence.citiesLost}失、${evidence.personalCityCaptures}得）；疆域${territory}，呈现持续争夺之势。`,
      `其长期处于攻守交替之中：在位${duration}，失城${evidence.citiesLost}座、亲征夺城${evidence.personalCityCaptures}座，疆域${territory}。`,
      `${duration}间城邑屡有得失，失城${evidence.citiesLost}座、亲征夺城${evidence.personalCityCaptures}座；疆域${territory}，其重在长期争衡而非一时胜负。`,
    ]);
  }
  if (roles.includes("UNIFIER")) return pick([
    "一统使天下格局为之一变，其功业足以成为时代分界。",
    "天下归一是其最具决定性的历史作为，后世纪年亦由此改观。",
    "其功不止于一国得失：完成统一，遂重定天下秩序。",
  ]);
  if (roles.includes("RESTORER")) return pick([
    "国祚中绝而复续，重建国家是其最清楚的历史功业。",
    "复国使断裂的政权重新延续，此事重于一般的疆土增损。",
    "其历史转折在于恢复故国；王统得续，已足见其功所在。",
  ]);
  if (roles.includes("INHERITED_HIGH_DECLINE")) return pick([
    "承统时国势已居高位，其后明显回落；所承之盛与未能维持之势，皆应并论。",
    "其并非创造前期高峰之人，却在任内见证疆域退缩，盛势终未守全。",
    "承接高位而未能维系，国势回落构成其统治最显著的历史落差。",
    "即位时已有较大疆域，后来却见明显收缩；承接的高位与身后的落差同样重要。",
    "前期高位并非由其一手创成，而其任内疆土回落，历史评价当分清承与失。",
  ]);
  if (roles.includes("PEAK_AND_RETREAT")) return pick([
    "其治下疆土一度扩展，终又显著回落；开拓与未能守成，是同一段历史的两面。",
    "其任内曾见疆域高点，而后大幅回落；虽末期政局趋稳，也不宜概以守成论其一世。",
    "拓展所至可称一时之盛，身后回落亦不可掩；其功与其失正在此处相接。",
  ]);
  if (roles.includes("EXPANDER") && evidence.territoryDelta >= 0.3) {
    const start = formatPrecisePercent(evidence.startTerritory);
    const end = formatPrecisePercent(evidence.endTerritory);
    const polity = evidence.formalStateAtReignEnd ? "国家" : "势力";
    const ending = roles.includes("TRAGIC_RULER")
      ? evidence.deathCause === "战死" ? "统治最终以战死告终。" : "统治最终以暴力结局告终。"
      : "";
    return pick([
      `其在位疆域由${start}扩至${end}，大规模拓境改变天下格局，开疆成为核心功业。${ending}`,
      `版图从${start}增至${end}，显著扩张重塑了当时的天下力量对比。${ending}`,
      `由${start}至${end}的疆域跃升，足见其拓境之举已深刻改变天下局势。${ending}`,
      `其世版图大幅外展：疆域${start}起而至${end}，${polity}规模与天下格局俱为之一变。${ending}`,
      `疆域由${start}扩展至${end}，如此幅度的开拓构成其最重要的历史遗产。${ending}`,
    ]);
  }
  if (roles.includes("SHORT_REIGN") && roles.includes("TRAGIC_RULER")) return pick([
    "在位短促而结局惨烈，现有事迹不足以铺陈完整治绩，国难与骤逝已是其史中重笔。",
    "短暂统治未及展开，战死或国难却已定下其结局；论其功过，当以谨慎为先。",
    "其治期甚短，无法据此作宽泛评断；可确言者，是功业未展而终局骤至。",
    "短祚之中遭遇战死或国难，现存事实足以说明结局，却不足以概括一生治绩。",
    "其位不久而终局骤至；应记下所见国难，不宜据此补写未有的治绩。",
  ]);
  if (roles.includes("EXPANDER") && roles.includes("TRAGIC_RULER")) {
    if (evidence.roles.includes("SHORT_REIGN")) {
      return pick([
        "疆域拓展已有实绩，但统治年限有限，战死使其事业未及充分展开。",
        "短祚中仍留下拓境记录，最终战死；可见功业有限，结局明确。",
        "其在有限在位时间内有所开拓，终局以战死告终，未竟之处由此可见。",
        "年少或短暂的统治留下拓境实绩，随后战死，未能继续其政治进程。",
        "开拓已经见于疆土变化，短暂统治却止于战事，后续发展无从验证。",
      ]);
    }
    return pick([
      "拓境之功尚在，其统治最终止于兵事；结局亦是其历史的一部分。",
      "其在进取中留下可见战果，最终战死，功业与结局并存。",
      "功业见于疆土与战事，最终结局亦应与拓境之绩一并记载。",
      "疆域拓展已有实证，其统治最终因战死而终。",
      "开拓的结果留在版图中，其一生最终止于军中。",
    ]);
  }
  if (roles.includes("LONG_EXILE")) {
    const fullExile = evidence.tenure.activeRuleMonths === 0;
    const opening = fullExile ? "承统虽久，却无一月在国治理；其所承接的是流亡中的王统。" :
      "流亡占据其承统岁月的大部，不能以承统之久代作在国治绩。";
    return opening + describeRulerExileEnding(evidence, true);
  }
  if (roles.includes("LAST_RULER")) return pick([
    "国亡于其世，但即位时的国势与此前危局亦须一并考量，不可把结局本身当作全部因果。",
    "其以末主身份承受国祚终结；判断其责任，还须分辨危局始于何时。",
    "王朝终于其世是确切结局，至于衰亡由来，则不能只凭末日一事定论。",
  ]);
  if (roles.includes("STEWARD")) return pick([
    "疆域无大起落而政权得以长久维持，守成之功在于使秩序不失。",
    "其治绩不以骤然拓境见长，而以长期维系政权与相对稳定为要。",
    "平稳延续本身即是其可考之绩；其功在维持，而非开创新的疆域高峰。",
  ]);
  if (roles.includes("DECLINER")) return pick([
    "国势在其任内显著下行，这一结果构成其统治难以回避的历史部分。",
    "其世所见主要是政权收缩与衰退；至于危局源流，仍须结合承统背景判断。",
    "国势未能维持，退缩成为其最突出的遗产；评价不应越出这些可见事实。",
    "疆土或城邑在其任内显著减少，衰退是这段统治最清楚的结果之一。",
    "其世未能阻止国势下滑；此结局确凿，成因仍需结合此前局势审视。",
  ]);
  if (roles.includes("EXPANDER")) return pick([
    "疆域扩展是其最显著的作为，国家规模由此发生实质变化。",
    "其历史分量主要来自开拓，所达峰值与最终留存仍须分别看待。",
    "开疆有据，拓展构成其主要功业；得地之后能否维持，则另有后话。",
    "疆域在其任内明显扩大，开拓构成其最突出的可考功绩。",
    "其推动国家版图外展，历史分量主要落在这一拓境成果上。",
  ]);
  if (roles.includes("FOUNDER") && evidence.foundedState) return pick([
    "其功在奠定政权起点，使后来王统有制可循。",
    "新政权由其手开其端绪，创业之功是其最清楚的历史位置。",
    "其留下的首要遗产是国家之始；其后成败，已非一人所能尽括。",
    "正式建国为后续政权确立起点，其创业之功有制度与国号可证。",
    "国家自其任内建立，后世王统由此获得明确的政治起源。",
  ]);
  if (roles.includes("FOUNDER")) return pick([
    "其创立势力，为后来政权留下可辨认的政治起点。",
    "本政权前身由其开其端绪，势力创始是其最明确的历史位置。",
    "其举事并创建势力，后来的国家沿此政治起点发展。",
    "创立势力是其可考之功；其后国家如何成形，还要看继任者的作为。",
    "其留下草创政权的起点，但这不等同于正式建国。",
  ]);
  if (roles.includes("STEWARD")) return "其治下未见显著收缩，长期维持秩序与政权，是可据史实称道之处。";
  if (roles.includes("SHORT_REIGN")) return pick([
    "在位短暂，现存记录不足以支持更重的功过判断。",
    "其统治时间有限，尚难据此形成完整的功过结论。",
    "短暂在位留下的材料有限，对其治绩宜持审慎判断。",
    "其治期不长，现有事实还不足以支持更广泛的评价。",
    "在位未久，除已见的具体事件外，不宜作过多推断。",
  ]);
  return "其可见历史评价应以现存事迹为限，不宜作超出证据的推断。";
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

export function formatAccessionAge(age: number) {
  if (age < 0) return "即位年龄未记录。";
  if (age <= 11) return `${age}岁幼年即位。`;
  if (age <= 15) return `${age}岁少年即位。`;
  if (age >= 60) return `${age}岁晚年即位。`;
  return `${age}岁即位。`;
}

function formatWorldDuration(months: number) {
  const years = Math.floor(months / 12);
  const remainder = months % 12;
  return remainder ? `${years}年${remainder}个月` : `${years}年`;
}

function hasMajorLegacy(evidence: RulerHistoricalEvidence) {
  return evidence.foundedFaction || evidence.foundedState || evidence.proclaimedEmperor ||
    evidence.completedUnification || evidence.restorationCount > 0 ||
    evidence.factionsDestroyedByFactionDuringReign > 0 || evidence.personalCityCaptures >= 2 ||
    evidence.roles.includes("EXPANDER");
}

function hasGovernanceCost(evidence: RulerHistoricalEvidence) {
  return (evidence.startPopulation > 0 && evidence.endPopulation <= evidence.startPopulation * 0.6) ||
    evidence.endStability - evidence.startStability <= -20;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(0)}%`;
}

function formatPrecisePercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function getTerritorialScaleJudgement(share: number) {
  if (share >= 0.3) return "跻身天下强权之列";
  if (share >= 0.18) return "成为重要割据力量";
  if (share >= 0.1) return "形成相当规模";
  return "开拓取得一定成果";
}

function uniqueLines(lines: string[]) {
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}
