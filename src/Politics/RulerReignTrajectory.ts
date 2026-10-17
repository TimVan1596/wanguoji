import { getRulerEffectiveSnapshot, type RulerChronicle } from "./RulerChronicle";

export interface RulerReignTrajectoryContext {
  activeRuleMonths?: number;
  exileMonths?: number;
  stateLosses?: number;
  restorations?: number;
  capitalLosses?: number;
  forcedRelocations?: number;
  nationalCityCaptures?: number;
  nationalCapitalCaptures?: number;
}

/** Read-only observations, not a reconstruction of unrecorded monthly history.
 * Peaks have no recorded dates; no city peak or intervening population trough is inferred. */
export function deriveRulerReignTrajectory(chronicle: RulerChronicle, context: RulerReignTrajectoryContext = {}) {
  const start = chronicle.accessionSnapshot, end = getRulerEffectiveSnapshot(chronicle);
  const peakTerritory = Math.max(start.territoryShare, end.territoryShare, chronicle.peakTerritoryShare);
  const peakPopulation = Math.max(start.population, end.population, chronicle.peakPopulation);
  const accessionToPeakGain = peakTerritory - start.territoryShare;
  const peakToEndRetreat = peakTerritory - end.territoryShare;
  const accessionToEndDelta = end.territoryShare - start.territoryShare;
  const populationPeakRetreat = peakPopulation - end.population;
  const majorExpansion = accessionToPeakGain >= 0.08;
  const majorTerritoryRetreat = peakToEndRetreat >= 0.12;
  const majorPopulationRetreat = populationPeakRetreat >= Math.max(5, peakPopulation * 0.4);
  const expandedThenRetreated = majorExpansion && majorTerritoryRetreat && peakToEndRetreat >= accessionToPeakGain * 0.5;
  const expandedAndRetained = majorExpansion && accessionToEndDelta >= accessionToPeakGain * 0.65;
  const inheritedDecline = !majorExpansion && majorTerritoryRetreat && accessionToEndDelta <= -0.08;
  const citiesLost = chronicle.citiesLostDuringReign;
  const restorations = Math.max(chronicle.restorationsDuringReign, context.restorations ?? 0);
  const disrupted = (context.stateLosses ?? 0) > 0 || (context.exileMonths ?? 0) > 0 || restorations > 0 ||
    (context.capitalLosses ?? 0) > 0 || (context.forcedRelocations ?? 0) > 0;
  const stableTrajectoryEligible = !majorTerritoryRetreat && !majorPopulationRetreat && citiesLost < 3 && !disrupted;
  const quietStewardshipEligible = stableTrajectoryEligible && !majorExpansion && citiesLost <= 1 &&
    chronicle.rebellionsDuringReign === 0 && (context.nationalCapitalCaptures ?? 0) === 0 && (context.nationalCityCaptures ?? 0) <= 1 && Math.abs(accessionToEndDelta) < 0.04 && Math.abs(end.cityCount - start.cityCount) <= 1;
  const recoveredAfterWarfare = citiesLost >= 3 && end.cityCount >= start.cityCount && accessionToEndDelta >= -0.04 && !majorTerritoryRetreat;
  return { accessionTerritory: start.territoryShare, peakTerritory, endTerritory: end.territoryShare,
    accessionToPeakGain, peakToEndRetreat, accessionToEndDelta, peakPopulation, populationPeakRetreat, citiesLost,
    activeRuleMonths: context.activeRuleMonths ?? Math.max(0, end.month - start.month), exileMonths: context.exileMonths ?? 0,
    stateLosses: context.stateLosses ?? 0, restorations, capitalLosses: context.capitalLosses ?? 0,
    nationalCityCaptures: context.nationalCityCaptures ?? 0, nationalCapitalCaptures: context.nationalCapitalCaptures ?? 0,
    majorExpansion, majorTerritoryRetreat, majorPopulationRetreat, expandedThenRetreated, expandedAndRetained, inheritedDecline,
    stableTrajectoryEligible, quietStewardshipEligible, recoveredAfterWarfare };
}
export type RulerReignTrajectory = ReturnType<typeof deriveRulerReignTrajectory>;
