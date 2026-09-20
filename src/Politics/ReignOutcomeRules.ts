import type { RulerReignSnapshot } from "./RulerChronicle";

export type ReignOutcome =
  | "EXPANSION"
  | "IMPROVEMENT"
  | "STABLE"
  | "MIXED"
  | "DECLINE";

export interface ReignOutcomeEvaluation {
  outcome: ReignOutcome;
  populationDelta: number;
  territoryDelta: number;
  cityDelta: number;
  stabilityDelta: number;
}

export const REIGN_TERRITORY_MAJOR_DELTA = 0.02;
export const REIGN_STABILITY_MAJOR_DELTA = 12;

export function evaluateReignOutcome(
  start: RulerReignSnapshot,
  end: RulerReignSnapshot
): ReignOutcomeEvaluation {
  const populationDelta = end.population - start.population;
  const territoryDelta = end.territoryShare - start.territoryShare;
  const cityDelta = end.cityCount - start.cityCount;
  const stabilityDelta = end.stability - start.stability;
  const territoryImproved = territoryDelta >= REIGN_TERRITORY_MAJOR_DELTA;
  const territoryDeclined = territoryDelta <= -REIGN_TERRITORY_MAJOR_DELTA;
  const citiesImproved = cityDelta >= 1;
  const citiesDeclined = cityDelta <= -1;
  const populationImproved = populationDelta > Math.max(2, start.population * 0.15);
  const populationDeclined = populationDelta < -Math.max(2, start.population * 0.15);
  const stabilityImproved = stabilityDelta >= REIGN_STABILITY_MAJOR_DELTA;
  const stabilityDeclined = stabilityDelta <= -REIGN_STABILITY_MAJOR_DELTA;
  const positiveSignals = [
    territoryImproved,
    citiesImproved,
    populationImproved,
    stabilityImproved,
  ].filter(Boolean).length;
  const negativeSignals = [
    territoryDeclined,
    citiesDeclined,
    populationDeclined,
    stabilityDeclined,
  ].filter(Boolean).length;

  let outcome: ReignOutcome = "STABLE";
  if ((territoryImproved || citiesImproved) && negativeSignals === 0) {
    outcome = "EXPANSION";
  } else if (positiveSignals > 0 && negativeSignals === 0) {
    outcome = "IMPROVEMENT";
  } else if ((territoryDeclined || citiesDeclined) && positiveSignals === 0) {
    outcome = "DECLINE";
  } else if (negativeSignals > 0 && positiveSignals === 0) {
    outcome = "DECLINE";
  } else if (positiveSignals > 0 && negativeSignals > 0) {
    outcome = "MIXED";
  }

  return {
    outcome,
    populationDelta,
    territoryDelta,
    cityDelta,
    stabilityDelta,
  };
}

export function formatTerritoryTransition(
  start: number,
  end: number
) {
  const verb = end >= start ? "增至" : "降至";
  const delta = (end - start) * 100;
  return `领土由${formatPercent(start)}${verb}${formatPercent(end)}（${
    delta >= 0 ? "+" : ""
  }${delta.toFixed(1)}pp）`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
