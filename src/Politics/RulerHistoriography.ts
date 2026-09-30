import type { WorldEvent } from "../History/WorldHistory";
import type { Dynasty, Ruler } from "./Dynasty";
import { getRulerEffectiveSnapshot } from "./RulerChronicle";
import { monthsToYears } from "../Simulation/WorldTime";

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
  | "TRAGIC_RULER";

export interface RulerHistoricalEvidence {
  rulerId: string;
  factionId: string;
  accessionAge?: number;
  finalAge?: number;
  reignMonths: number;
  isFinalized: boolean;
  foundedFaction: boolean;
  foundedState: boolean;
  foundedStateName?: string;
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
  accessionCrisis: boolean;
  terminalCollapse: boolean;
  roles: HistoricalRole[];
}

export interface RulerHistoriographyContext {
  ruler: Ruler;
  dynasty: Pick<Dynasty, "rulers">;
  faction: { name: string; origin?: { foundingRulerId?: string } };
  events: WorldEvent[];
  worldMonth: number;
}

export interface RulerAssessment {
  heading: "史评" | "在位评议";
  evidence: RulerHistoricalEvidence;
  lines: string[];
}

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
  const inReign = (event: WorldEvent) => {
    const month = event.monthIndex ?? event.year;
    return month >= accessionMonth && month <= endMonth;
  };
  const directToRuler = (event: WorldEvent) =>
    event.rulerId === ruler.id || event.metadata?.rulerId === ruler.id;
  const rulerEvents = events.filter(inReign);

  const foundingFactionEvent = rulerEvents.some(
    (event) =>
      (event.type === "rebel-faction-founded" || event.type === "frontier-faction-founded") &&
      event.actorFactionId === faction.name &&
      event.metadata?.foundingRulerId === ruler.id
  );
  const foundedFaction = faction.origin?.foundingRulerId === ruler.id || foundingFactionEvent;
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
  const accessionCrisis =
    accessionSnapshot.cityCount <= 1 ||
    accessionSnapshot.territoryShare <= 0.12 ||
    accessionSnapshot.stability <= 45;
  const ownTerminalCollapse = ruler.endReason === "彻底灭亡" || ruler.endReason === "流亡";
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
  if (reignMonths >= 18 * 12 && finalSnapshot.stability >= 72 && !majorDecline) roles.push("STEWARD");
  if (accessionCrisis && !ownTerminalCollapse) roles.push("CRISIS_SURVIVOR");
  if (territorialPeakRetreat >= 0.15) {
    if (territorialPeakGain >= 0.08 && peakTerritory >= 0.3) roles.push("PEAK_AND_RETREAT");
    else if (accessionSnapshot.territoryShare >= 0.3) roles.push("INHERITED_HIGH_DECLINE");
  }
  if (moderateRecovery) roles.push("MODERATE_RECOVERY");
  if (majorDecline) roles.push("DECLINER");
  if (ownTerminalCollapse) roles.push("LAST_RULER");
  if (reignMonths <= 5 * 12) roles.push("SHORT_REIGN");
  if (["战死", "被俘处死"].includes(ruler.endReason ?? "")) roles.push("TRAGIC_RULER");

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
    isFinalized,
    foundedFaction,
    foundedState,
    foundedStateName,
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
    accessionCrisis,
    terminalCollapse: ownTerminalCollapse,
    roles,
  };
}

export function composeRulerAssessment(evidence: RulerHistoricalEvidence): RulerAssessment {
  const lines: string[] = [];
  const livingPrefix = evidence.isFinalized ? "" : "截至目前，";
  const childAccession = evidence.accessionAge !== undefined && evidence.accessionAge <= 11;
  const youthAccession = evidence.accessionAge !== undefined && evidence.accessionAge >= 12 && evidence.accessionAge <= 15;
  const agePrefix = childAccession ? "幼年承统，" : youthAccession ? "少年即位，" : "";

  if (evidence.foundedState) {
    lines.push(`${livingPrefix}${agePrefix}其开创之功在于正式建国${evidence.foundedStateName ? `、奠定${evidence.foundedStateName}国统` : "，使政权成为正式国家"}。`);
  } else if (evidence.foundedFaction) {
    lines.push(`${livingPrefix}${agePrefix}其以创建政权开其端绪，留下了可辨认的政治起点。`);
  } else if (evidence.proclaimedEmperor) {
    lines.push(`${livingPrefix}${agePrefix}其称帝完成了本朝由王权到帝制的关键转折。`);
  } else if (evidence.restorationCount > 0) {
    lines.push(`${livingPrefix}${agePrefix}复国与重建王统，是其最突出的历史功业。`);
  } else if (evidence.completedUnification) {
    lines.push(`${livingPrefix}${agePrefix}完成天下统一，使其历史地位超出一国兴替。`);
  } else if (evidence.terminalCollapse && evidence.accessionCrisis) {
    lines.push(`${agePrefix}承统之时国势已陷危局${evidence.startCityCount <= 1 ? "，仅据孤城" : ""}，并非由盛转衰的始作俑者。`);
  } else if (evidence.roles.includes("CRISIS_SURVIVOR")) {
    lines.push(`${livingPrefix}${agePrefix}临危承统，其主要考验在于维系既有政权，而非开拓疆土。`);
  } else if (evidence.roles.includes("INHERITED_HIGH_DECLINE")) {
    lines.push(`${livingPrefix}承统时国势已居高位，其后疆域显著回落，未能维持前期盛势。`);
  } else if (evidence.roles.includes("MODERATE_RECOVERY")) {
    lines.push(`${livingPrefix}其在位未形成决定性扩张，但人口、疆域与稳定均有所恢复，治绩更近恢复而非开创。`);
  } else if (evidence.roles.includes("STEWARD")) {
    lines.push(`${livingPrefix}其治下少有显著拓境，长久维持政权与秩序，守成为其主要遗产。`);
  } else if (evidence.roles.includes("PEAK_AND_RETREAT")) {
    lines.push(`${livingPrefix}其治下疆域由${formatPercent(evidence.startTerritory)}拓展至${formatPercent(evidence.peakTerritory)}，一度达到鼎盛；如何维系盛势成为其政治遗产的关键。`);
  } else if (evidence.roles.includes("SHORT_REIGN") && !hasMajorLegacy(evidence)) {
    lines.push(`${livingPrefix}在位不足五年，现有史实尚不足以形成明确的治绩判断。`);
  } else if (evidence.roles.includes("EXPANDER")) {
    lines.push(`${livingPrefix}${agePrefix}其治下国势显著开拓，可称一代进取之主；其政治遗产以拓境为重。`);
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
    lines.push(`其疆域一度达到${formatPercent(evidence.peakTerritory)}，开拓使国家${getTerritorialScaleJudgement(evidence.peakTerritory)}。`);
  }

  if (evidence.territorialPeakRetreat >= 0.15) {
    if (evidence.territorialPeakGain >= 0.08) {
      lines.push(`其治下疆域一度达到${formatPercent(evidence.peakTerritory)}${evidence.peakTerritory >= 0.3 ? "，一度跻身天下强权" : ""}，至${evidence.isFinalized ? "身后" : "目前"}已明显回落，盛势未能维持。`);
    } else if (evidence.startTerritory >= 0.3) {
      lines.push(`承统时疆域已有${formatPercent(evidence.startTerritory)}，至${evidence.isFinalized ? "身后" : "目前"}回落至${formatPercent(evidence.endTerritory)}，未能维持前期高位。`);
    } else {
      lines.push(`疆域一度达到${formatPercent(evidence.peakTerritory)}，至${evidence.isFinalized ? "身后" : "目前"}已明显回落。`);
    }
  } else if (
    evidence.populationPeakGain >= Math.max(3, evidence.startPopulation * 0.25) &&
    evidence.populationPeakRetreat >= Math.max(8, evidence.peakPopulation * 0.35)
  ) {
    lines.push(`人口一度达到${evidence.peakPopulation}，至${evidence.isFinalized ? "身后" : "目前"}明显回落，盛势未能转化为稳定基础。`);
  } else if (hasGovernanceCost(evidence) && evidence.roles.includes("EXPANDER")) {
    lines.push(evidence.startPopulation > 0 && evidence.endPopulation <= evidence.startPopulation * 0.6
      ? "开拓伴随明显代价，可谓得地而失民；人口与稳定的承受能力未能同步。"
      : "其功在开拓，但稳定度明显下滑，扩张成果伴随沉重的治理代价。");
  } else if (
    evidence.startPopulation > 0 &&
    evidence.populationPeakGain < Math.max(3, evidence.startPopulation * 0.25) &&
    evidence.startPopulation - evidence.endPopulation >= Math.max(5, evidence.startPopulation * 0.35)
  ) {
    lines.push(`承统时人口已有${evidence.startPopulation}，至${evidence.isFinalized ? "身后" : "目前"}降至${evidence.endPopulation}。`);
  } else if (evidence.forcedCapitalRelocationsDuringReign >= 2) {
    lines.push(`在位期间两度失都，王室被迫迁徙${evidence.rebellions > 0 ? "，又屡经内乱" : ""}；` +
      (evidence.terminalCollapse ? "最终未能保全国祚。" : "政权仍得以延续。"));
  } else if (evidence.rebellions > 0) {
    lines.push(`${evidence.rebellions >= 2 ? "其治下内乱频仍" : "其治下发生重大内乱"}，政权承受了持续的内部压力${evidence.terminalCollapse ? "，终亡于其世" : "，但国统仍得延续"}。`);
  } else if (evidence.predeceasedHeirCount >= 2) {
    lines.push("两度折嗣，晚年继统屡有变数，继承秩序因此受到冲击。");
  } else if (evidence.predeceasedHeirCount === 1) {
    lines.push("储嗣先于其父君去世，继承秩序因此受到冲击。");
  }

  if (evidence.terminalCollapse && !evidence.accessionCrisis) {
    lines.push("国势在其任内进一步恶化，最终亡于其世。");
  } else if (evidence.terminalCollapse && evidence.accessionCrisis) {
    lines.push("其后仍未能扭转颓势，国家终亡于其世；这一结局始于承统前的危局。");
  } else if (evidence.deathCause === "战死" && hasMajorLegacy(evidence)) {
    lines.push("功业未竟而身死军中，留下的扩张与秩序仍有未竟之处。");
  } else if (evidence.roles.includes("DECLINER") && !evidence.roles.includes("PEAK_AND_RETREAT")) {
    lines.push("国势在其任内显著衰退，主要遗产因而蒙上阴影。");
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

export function formatAccessionAge(age: number) {
  if (age < 0) return "即位年龄未记录。";
  if (age <= 11) return `${age}岁幼年即位。`;
  if (age <= 15) return `${age}岁少年即位。`;
  if (age >= 60) return `${age}岁晚年即位。`;
  return `${age}岁即位。`;
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

function getTerritorialScaleJudgement(share: number) {
  if (share >= 0.3) return "跻身天下强权之列";
  if (share >= 0.18) return "成为重要割据力量";
  if (share >= 0.1) return "形成相当规模";
  return "开拓取得一定成果";
}

function uniqueLines(lines: string[]) {
  return [...new Set(lines.map((line) => line.trim()).filter(Boolean))];
}
