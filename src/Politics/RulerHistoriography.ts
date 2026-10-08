import type { WorldEvent } from "../History/WorldHistory";
import type { Dynasty, Ruler } from "./Dynasty";
import { getRulerEffectiveSnapshot } from "./RulerChronicle";
import { monthsToYears } from "../Simulation/WorldTime";
import { deriveRulerTenureEvidence, type RulerTenureEvidence } from "./RulerTenureEvidence";
import { buildRulerLegacyEvidence } from "./RulerLegacyEvidence";

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
  rulerId: string;
  factionId: string;
  accessionAge?: number;
  finalAge?: number;
  reignMonths: number;
  tenure: RulerTenureEvidence;
  isFinalized: boolean;
  rulerStatus?: Ruler["status"];
  foundedFaction: boolean;
  foundedState: boolean;
  formalStateAtReignEnd: boolean;
  foundedStateName?: string;
  monthsSinceStateFoundationAtEnd?: number;
  monthsSinceFactionFoundationAtEnd?: number;
  proclaimedEmperor: boolean;
  completedUnification: boolean;
  restorationCount: number;
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
const DEATH_END_REASONS = new Set(["去世", "自然去世", "战死", "被俘处死"]);

export function deriveRulerHistoricalEvidence(
  context: RulerHistoriographyContext
): RulerHistoricalEvidence {
  const { ruler, dynasty, faction, events, worldMonth } = context;
  const chronicle = ruler.chronicle;
  const start = chronicle?.accessionSnapshot;
  const end = chronicle ? getRulerEffectiveSnapshot(chronicle) : undefined;
  const accessionMonth = ruler.accessionYear ?? start?.month ?? worldMonth;
  const endMonth = ruler.endYear ?? worldMonth;
  const isFinalized = ruler.endYear !== undefined;
  const tenure = deriveRulerTenureEvidence(ruler, faction.name, events, worldMonth);
  const legacyEvidence = chronicle
    ? buildRulerLegacyEvidence(
        chronicle,
        accessionMonth,
        ruler.endYear,
        tenure.diedInExile ? "流亡" : ruler.endReason,
        tenure.activeRuleMonths
      )
    : undefined;
  const inReign = (event: WorldEvent) => {
    const month = event.monthIndex ?? event.year;
    return month >= accessionMonth && month <= endMonth;
  };
  const directToRuler = (event: WorldEvent) =>
    event.rulerId === ruler.id || event.metadata?.rulerId === ruler.id;
  const rulerEvents = events.filter(inReign);

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
  const directlyAttributedDestroyedGroups = [...collapseGroups.values()].filter((collapse) => {
    if (collapse.rulerId === ruler.id || collapse.metadata?.conquerorRulerId === ruler.id) return true;
    const groupId = collapse.historyGroupId;
    if (!groupId) return false;
    return rulerEvents.some(
      (event) =>
        event.historyGroupId === groupId &&
        (event.type === "city-captured" || event.type === "capital-fallen") &&
        event.actorFactionId === faction.name &&
        event.rulerId === ruler.id
    );
  }).length;

  const parentEndMonth = ruler.endYear ?? worldMonth;
  const predeceasedHeirCount = dynasty.rulers.filter((candidate) => {
    const candidateEnd = candidate.endYear ?? candidate.politicalEndYear;
    return Boolean(
      candidate.parentId === ruler.id &&
        candidate.reignOrdinal === undefined &&
        candidateEnd !== undefined &&
        candidateEnd < parentEndMonth &&
        candidate.endReason &&
        DEATH_END_REASONS.has(candidate.endReason)
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
  const peakPopulation = chronicle?.peakPopulation ?? finalSnapshot.population;
  const peakTerritory = chronicle?.peakTerritoryShare ?? finalSnapshot.territoryShare;
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
  const ownTerminalCollapse = ruler.endReason === "彻底灭亡" || ruler.endReason === "流亡" || tenure.diedInExile || tenure.extinctInExile;
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
  if ((chronicle?.restorationsDuringReign ?? 0) > 0) roles.push("RESTORER");
  if (completedUnification) roles.push("UNIFIER");
  if (expansion) roles.push("EXPANDER");
  if ((chronicle?.citiesCapturedPersonally ?? 0) >= 2 || collapseGroups.size > 0) roles.push("CONQUEROR");
  if (
    tenure.activeRuleMonths >= 18 * 12 && legacyEvidence?.stableGovernanceEligible &&
    !majorDecline && !tenure.lostStateDuringTenure && !expansion &&
    Math.abs(territoryDelta) < 0.12 && cityDelta <= 2
  ) roles.push("STEWARD");
  if (accessionCrisis && !ownTerminalCollapse) roles.push("CRISIS_SURVIVOR");
  if (territorialPeakRetreat >= 0.15) {
    if (territorialPeakGain >= 0.08 && peakTerritory >= 0.3) roles.push("PEAK_AND_RETREAT");
    else if (accessionSnapshot.territoryShare >= 0.3) roles.push("INHERITED_HIGH_DECLINE");
  }
  if (moderateRecovery) roles.push("MODERATE_RECOVERY");
  if (
    tenure.activeRuleMonths >= 30 * 12 &&
    (chronicle?.citiesLostDuringReign ?? 0) >= 6 &&
    (chronicle?.citiesCapturedPersonally ?? 0) >= 2 &&
    territoryDelta > -0.12 &&
    !majorDecline &&
    !ownTerminalCollapse
  ) roles.push("CONTESTED_REIGN");
  if (majorDecline) roles.push("DECLINER");
  if (ownTerminalCollapse) roles.push("LAST_RULER");
  if (tenure.activeRuleMonths <= 5 * 12) roles.push("SHORT_REIGN");
  if (["战死", "被俘处死"].includes(ruler.endReason ?? "")) roles.push("TRAGIC_RULER");
  if (tenure.exiledAtAccession || tenure.exileMonths > 0) roles.push("EXILED_RULER");
  if (tenure.exileMonths >= 5 * 12 && tenure.exileMonths > tenure.activeRuleMonths) roles.push("LONG_EXILE");
  if (tenure.restoredDuringTenure && tenure.exileEpisodeCount > 0) roles.push("RESTORED_FROM_EXILE");

  const accessionAge = ruler.bornYear !== undefined
    ? Math.floor(monthsToYears(accessionMonth - ruler.bornYear))
    : undefined;
  const finalAge = ruler.bornYear !== undefined
    ? Math.floor(monthsToYears(endMonth - ruler.bornYear))
    : undefined;

  return {
    rulerId: ruler.id,
    factionId: faction.name,
    accessionAge,
    finalAge,
    reignMonths,
    tenure,
    isFinalized,
    rulerStatus: ruler.status,
    foundedFaction,
    foundedState,
    formalStateAtReignEnd,
    foundedStateName,
    monthsSinceStateFoundationAtEnd,
    monthsSinceFactionFoundationAtEnd,
    proclaimedEmperor,
    completedUnification,
    restorationCount: chronicle?.restorationsDuringReign ?? 0,
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
    factionsDestroyedByFactionDuringReign: collapseGroups.size,
    factionsDestroyedDirectlyAttributedToRuler: directlyAttributedDestroyedGroups,
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
  };
}

export function composeRulerAssessment(evidence: RulerHistoricalEvidence): RulerAssessment {
  const lines: string[] = [];
  const abdicated = evidence.rulerStatus === "abdicated";
  const finalTime = evidence.isFinalized ? (abdicated ? "退位时" : "身后") : "目前";
  const livingPrefix = evidence.isFinalized ? "" : "截至目前，";
  const childAccession = evidence.accessionAge !== undefined && evidence.accessionAge <= 11;
  const youthAccession = evidence.accessionAge !== undefined && evidence.accessionAge >= 12 && evidence.accessionAge <= 15;
  const agePrefix = childAccession ? "幼年承统，" : youthAccession ? "少年即位，" : "";

  if (evidence.roles.includes("RESTORED_FROM_EXILE")) {
    lines.push(`亡国流亡${formatWorldDuration(evidence.tenure.restoredExileMonths)}后恢复国家，复国成为其${evidence.isFinalized ? (abdicated ? "承统经历中" : "一生") : "截至目前"}最重要的历史转折。`);
    if (evidence.tenure.exileMonths > evidence.tenure.restoredExileMonths) {
      lines.push(`其后仍有流亡经历，累计流亡${formatWorldDuration(evidence.tenure.exileMonths)}。`);
    }
    return { heading: evidence.isFinalized ? "史评" : "在位评议", evidence, lines };
  }
  if (evidence.roles.includes("LONG_EXILE")) {
    if (evidence.tenure.exiledAtAccession && evidence.tenure.activeRuleMonths <= 12) {
      const exileAccession = childAccession ? "幼年承接流亡王统" : youthAccession ? "少年承接流亡王统" : "承接流亡王统";
      lines.push(`${exileAccession}，${evidence.isFinalized ? (abdicated ? "其承统期间" : "其一生") : "截至目前的承统岁月中，大部分时间"}没有实际控制城邑。`);
      lines.push(`${evidence.isFinalized ? "其历史角色主要在于延续王统与复国希望，而非持续治理一个在国政权。" : "目前其身份更接近流亡王统的延续者，而非持续治理在国政权的君主。"}`);
    } else if (evidence.tenure.lostStateDuringTenure && (evidence.tenure.monthsUntilFirstExile ?? Infinity) <= 12) {
      lines.push(evidence.isFinalized
        ? (abdicated ? "即位不久即失去国土，此后王室长期流亡，至退位时未能复国。" : "即位不久即失去国土，此后王室长期流亡，终其一生未能复国。")
        : "即位不久即失去国土，此后王室长期流亡；截至目前尚未复国。");
    } else if (evidence.tenure.diedInExile) {
      lines.push(`其治下国土终失，后半生长期流亡，累计流亡${formatWorldDuration(evidence.tenure.exileMonths)}，未能复国。`);
    } else {
      lines.push(`在位期间历经流亡，流亡${formatWorldDuration(evidence.tenure.exileMonths)}；在国治理时间为${formatWorldDuration(evidence.tenure.activeRuleMonths)}。`);
    }
    if (evidence.tenure.extinctInExile) lines.push("王统与残部最终绝于流亡时期。");
    return { heading: evidence.isFinalized ? "史评" : "在位评议", evidence, lines: lines.slice(0, 4) };
  }

  if (evidence.foundedState) {
    lines.push(`${livingPrefix}${agePrefix}其开创之功在于正式建国${evidence.foundedStateName ? `、奠定${evidence.foundedStateName}国统` : "，使政权成为正式国家"}。`);
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
    lines.push(`${agePrefix}其时国势已陷危局${evidence.startCityCount <= 1 ? "，仅据孤城" : ""}，并非由盛转衰的始作俑者。`);
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
    lines.push(`${livingPrefix}其治下疆域由${formatPercent(evidence.startTerritory)}拓展至${formatPercent(evidence.peakTerritory)}，一度达到鼎盛；如何维系盛势成为其政治遗产的关键。`);
  } else if (evidence.roles.includes("EXPANDER")) {
    lines.push(`${livingPrefix}${agePrefix}其治下国势显著开拓，可称一代进取之主；其政治遗产以拓境为重。`);
  } else if (evidence.roles.includes("STEWARD")) {
    lines.push(`${livingPrefix}其治下少有显著拓境，长久维持政权与秩序，守成为其主要遗产。`);
  } else if (evidence.roles.includes("SHORT_REIGN") && !hasMajorLegacy(evidence)) {
    lines.push(`${livingPrefix}在位不足五年，现有史实尚不足以形成明确的治绩判断。`);
  } else if (evidence.roles.includes("LAST_RULER")) {
    lines.push(`${agePrefix}其世国祚终结，结局为亡国之君。`);
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

  if (evidence.territorialPeakRetreat >= 0.15) {
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
    const successionLoss = abdicated
      ? `在位期间有${evidence.predeceasedHeirCount}名继承候选去世，继承秩序因此受到冲击。`
      : formatPredeceasedHeirAssessment(evidence.predeceasedHeirCount);
    if (successionLoss) lines.push(successionLoss);
  }

  if (evidence.terminalCollapse && !evidence.accessionCrisis) {
    lines.push("国势在其任内进一步恶化，最终亡于其世。");
  } else if (evidence.terminalCollapse && evidence.accessionCrisis) {
    lines.push("其后仍未能扭转颓势，国家终亡于其世；这一结局始于承统前的危局。");
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
  } else if (
    evidence.roles.includes("DECLINER") && !evidence.roles.includes("PEAK_AND_RETREAT") &&
    !lines.some((line) => line.includes("终未能复其旧势"))
  ) {
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

export function deriveRulerAssessment(context: RulerHistoriographyContext) {
  return composeRulerAssessment(deriveRulerHistoricalEvidence(context));
}

/** A compact, deterministic final judgement, derived only from recorded outcomes. */
export function composeHistorianVoice(evidence: RulerHistoricalEvidence): string | undefined {
  if (!evidence.isFinalized) return undefined;
  const pick = (lines: string[]) => {
    const text = lines[stableHash(evidence.rulerId) % lines.length];
    return evidence.rulerStatus === "abdicated"
      ? text.replaceAll("身后", "退位时").replaceAll("其一生", "其承统期间").replaceAll("一生治绩", "在位治绩")
      : text;
  };
  const roles = evidence.roles;

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
    "国势由其手推至高峰，终又显著回落；开拓与未能守成，是同一段历史的两面。",
    "其曾创在位期间的疆域高点，却未能把峰值留到身后。",
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
    if (evidence.roles.includes("SHORT_REIGN") || (evidence.finalAge !== undefined && evidence.finalAge <= 25)) {
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
  if (roles.includes("LONG_EXILE")) return pick([
    `其承统岁月多在流亡中度过，历史位置主要系于王统延续，而非持续治理在国政权。`,
    `流亡占据其承统生涯的大部，王统未绝是其身后最重要的遗留。`,
    `其一生受国土沦失所限，所能维系者是流亡中的王统，而非疆域治理。`,
  ]);
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
