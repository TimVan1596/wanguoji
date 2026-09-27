import type { RulerChronicle } from "./RulerChronicle";
import { getRulerEffectiveSnapshot } from "./RulerChronicle";

export interface RulerLegacyEvidence {
  foundedState: boolean;
  proclaimedEmperor: boolean;
  completedUnification: boolean;
  restoration: boolean;
  accessionMonth: number;
  endMonth?: number;
  reignMonths: number;
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
  strongExpansion: boolean;
  severeDecline: boolean;
  steadyRule: boolean;
}

export function buildRulerLegacyEvidence(
  chronicle: RulerChronicle,
  accessionMonth: number,
  endMonth?: number,
  endReason?: string
): RulerLegacyEvidence {
  const start = chronicle.accessionSnapshot;
  const end = getRulerEffectiveSnapshot(chronicle);
  const territoryDelta = end.territoryShare - start.territoryShare;
  const cityDelta = end.cityCount - start.cityCount;
  const stabilityDelta = end.stability - start.stability;
  const reignMonths = Math.max(0, (endMonth ?? end.month) - accessionMonth);
  return {
    foundedState: Boolean(chronicle.foundedStateName),
    proclaimedEmperor: chronicle.proclaimedEmperorMonth !== undefined,
    completedUnification: chronicle.completedUnification,
    restoration: chronicle.restorationsDuringReign > 0,
    accessionMonth,
    endMonth,
    reignMonths,
    accessionSnapshot: start,
    latestSnapshot: chronicle.latestSnapshot,
    endSnapshot: chronicle.endSnapshot,
    populationDelta: end.population - start.population,
    territoryDelta,
    cityDelta,
    stabilityDelta,
    peakPopulation: chronicle.peakPopulation,
    peakTerritory: chronicle.peakTerritoryShare,
    personallyCapturedCities: chronicle.citiesCapturedPersonally,
    citiesLost: chronicle.citiesLostDuringReign,
    rebellions: chronicle.rebellionsDuringReign,
    restorations: chronicle.restorationsDuringReign,
    endReason,
    deathCause: chronicle.deathCause,
    exileOrExtinction: endReason === "流亡" || endReason === "彻底灭亡",
    strongExpansion: territoryDelta >= 0.16 || cityDelta >= 3 || chronicle.completedUnification,
    severeDecline: territoryDelta <= -0.12 || cityDelta <= -2 || end.population <= start.population * 0.6 || endReason === "彻底灭亡",
    steadyRule: reignMonths >= 18 * 12 && end.stability >= 72 && Math.abs(territoryDelta) < 0.04 && cityDelta === 0,
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
