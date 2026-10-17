import { deriveRulerReignTrajectory, type RulerReignTrajectory, type RulerReignTrajectoryContext } from "./RulerReignTrajectory";
import type { RulerChronicle } from "./RulerChronicle";
import { getRulerEffectiveSnapshot } from "./RulerChronicle";

export interface RulerLegacyEvidence {
  trajectory: RulerReignTrajectory;
  foundedState: boolean;
  proclaimedEmperor: boolean;
  completedUnification: boolean;
  restoration: boolean;
  durableRestoration: boolean;
  personalCapitalCaptures: number;
  personalExtinctions: number;
  changedHouse: boolean;
  accessionMonth: number;
  endMonth?: number;
  reignMonths: number;
  activeRuleMonths: number;
  accessionSnapshot: RulerChronicle["accessionSnapshot"];
  latestSnapshot: RulerChronicle["latestSnapshot"];
  endSnapshot: RulerChronicle["endSnapshot"];
  populationDelta: number;
  territoryDelta: number;
  cityDelta: number;
  stabilityDelta: number;
  peakPopulation: number;
  peakTerritory: number;
  personallyCapturedCities: number;
  citiesLost: number;
  rebellions: number;
  restorations: number;
  endReason?: string;
  deathCause?: string;
  exileOrExtinction: boolean;
  majorExpansion: boolean;
  militaryAchievement: boolean;
  institutionalAchievement: boolean;
  stableGovernanceEligible: boolean;
  stableGovernance: boolean;
  longStableReign: boolean;
  stabilityDeterioration: boolean;
  demographicCollapse: boolean;
  territorialCollapse: boolean;
  cityCollapse: boolean;
  majorDisorder: boolean;
  terminalCollapse: boolean;
  tragicEnd: boolean;
  governanceCost: boolean;
  strongExpansion: boolean;
  severeDecline: boolean;
  steadyRule: boolean;
}

export function buildRulerLegacyEvidence(
  chronicle: RulerChronicle,
  accessionMonth: number,
  endMonth?: number,
  endReason?: string,
  activeRuleMonths = Math.max(0, (endMonth ?? getRulerEffectiveSnapshot(chronicle).month) - accessionMonth),
  facts?: RulerReignTrajectoryContext & { restorations: number; personalCityCaptures: number; personalCapitalCaptures: number; personalExtinctions: number; terminalCollapse: boolean; changedHouse: boolean; restoredActiveRuleMonths: number }
): RulerLegacyEvidence {
  const start = chronicle.accessionSnapshot;
  const end = getRulerEffectiveSnapshot(chronicle);
  const territoryDelta = end.territoryShare - start.territoryShare;
  const cityDelta = end.cityCount - start.cityCount;
  const stabilityDelta = end.stability - start.stability;
  const reignMonths = Math.max(0, (endMonth ?? end.month) - accessionMonth);
  const governedMonths = Math.min(reignMonths, Math.max(0, activeRuleMonths));
  const territorialCollapse = territoryDelta <= -0.12;
  const cityCollapse = cityDelta <= -2;
  const terminalCollapse = facts?.terminalCollapse ?? (endReason === "政治终结" || endReason === "彻底灭亡");
  const restorations = Math.max(chronicle.restorationsDuringReign, facts?.restorations ?? 0);
  const captures = Math.max(chronicle.citiesCapturedPersonally, facts?.personalCityCaptures ?? 0);
  const trajectory = deriveRulerReignTrajectory(chronicle, { ...facts, activeRuleMonths: governedMonths });
  const stableGovernanceEligible =
    trajectory.stableTrajectoryEligible &&
    end.stability >= 75 &&
    stabilityDelta >= 0 &&
    !territorialCollapse &&
    !cityCollapse &&
    !terminalCollapse &&
    territoryDelta > -0.06 &&
    cityDelta >= -1 &&
    !(start.cityCount >= 3 && end.cityCount <= 1);
  return {
    trajectory,
    foundedState: Boolean(chronicle.foundedStateName),
    proclaimedEmperor: chronicle.proclaimedEmperorMonth !== undefined,
    completedUnification: chronicle.completedUnification,
    restoration: restorations > 0,
    durableRestoration: restorations > 0 && (facts?.restoredActiveRuleMonths ?? 0) >= 10 * 12,
    personalCapitalCaptures: facts?.personalCapitalCaptures ?? 0,
    personalExtinctions: facts?.personalExtinctions ?? 0,
    changedHouse: facts?.changedHouse ?? false,
    accessionMonth,
    endMonth,
    reignMonths,
    activeRuleMonths: governedMonths,
    accessionSnapshot: start,
    latestSnapshot: chronicle.latestSnapshot,
    endSnapshot: chronicle.endSnapshot,
    populationDelta: end.population - start.population,
    territoryDelta,
    cityDelta,
    stabilityDelta,
    peakPopulation: chronicle.peakPopulation,
    peakTerritory: chronicle.peakTerritoryShare,
    personallyCapturedCities: captures,
    citiesLost: chronicle.citiesLostDuringReign,
    rebellions: chronicle.rebellionsDuringReign,
    restorations: restorations,
    endReason,
    deathCause: chronicle.deathCause,
    exileOrExtinction: endReason === "流亡" || endReason === "彻底灭亡",
    majorExpansion: territoryDelta >= 0.12 || cityDelta >= 3 || chronicle.completedUnification,
    militaryAchievement: captures >= 2 || (facts?.personalCapitalCaptures ?? 0) > 0 || (facts?.personalExtinctions ?? 0) > 0 || chronicle.completedUnification,
    institutionalAchievement: Boolean(chronicle.foundedStateName) || chronicle.proclaimedEmperorMonth !== undefined || chronicle.completedUnification || chronicle.restorationsDuringReign > 0,
    stableGovernanceEligible,
    stableGovernance: stableGovernanceEligible,
    longStableReign: governedMonths >= 18 * 12 && stableGovernanceEligible,
    stabilityDeterioration: stabilityDelta <= -25,
    demographicCollapse: start.population > 0 && end.population <= start.population * 0.6,
    territorialCollapse,
    cityCollapse,
    majorDisorder: chronicle.rebellionsDuringReign > 0,
    terminalCollapse,
    tragicEnd: endReason === "被俘处死" || chronicle.deathCause === "被俘处死" || chronicle.deathCause === "战死" || endReason === "彻底灭亡",
    governanceCost: (start.population > 0 && end.population <= start.population * 0.6) || stabilityDelta <= -20,
    strongExpansion: territoryDelta >= 0.16 || cityDelta >= 3 || chronicle.completedUnification,
    severeDecline: territoryDelta <= -0.12 || cityDelta <= -2 || (start.population > 0 && end.population <= start.population * 0.6) || endReason === "彻底灭亡",
    steadyRule: governedMonths >= 18 * 12 && stableGovernanceEligible && trajectory.quietStewardshipEligible && cityDelta === 0,
  };
}

export type RulerLegacyClass = "FOUNDING" | "RESTORATION" | "UNIFICATION" | "MAJOR_EXPANSION" | "STEADY_RULE" | "DECLINE" | "MAJOR_REBELLION" | "EXILE" | "EXTINCTION" | "TRAGIC_END";

export function getRulerLegacyClasses(evidence: RulerLegacyEvidence): RulerLegacyClass[] {
  const classes: RulerLegacyClass[] = [];
  if (evidence.foundedState) classes.push("FOUNDING");
  if (evidence.restoration) classes.push("RESTORATION");
  if (evidence.completedUnification) classes.push("UNIFICATION");
  if (evidence.strongExpansion && !evidence.completedUnification) classes.push("MAJOR_EXPANSION");
  if (evidence.steadyRule) classes.push("STEADY_RULE");
  if (evidence.severeDecline) classes.push("DECLINE");
  if (evidence.rebellions > 0) classes.push("MAJOR_REBELLION");
  if (evidence.endReason === "流亡") classes.push("EXILE");
  if (evidence.endReason === "彻底灭亡") classes.push("EXTINCTION");
  if (evidence.deathCause === "被俘处死" || evidence.deathCause === "战死") classes.push("TRAGIC_END");
  return classes;
}

export function getRulerLegacyScore(evidence: RulerLegacyEvidence) {
  const classes = getRulerLegacyClasses(evidence);
  return classes.reduce((score, item) => score + ({ FOUNDING: 100, RESTORATION: 95, UNIFICATION: 95, MAJOR_EXPANSION: 65, STEADY_RULE: 35, DECLINE: 45, MAJOR_REBELLION: 25, EXILE: 35, EXTINCTION: 50, TRAGIC_END: 20 }[item]), 0);
}
