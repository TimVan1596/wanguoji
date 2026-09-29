import type { NameCulture } from "./NameCulture";

export interface NameGenerationSummary {
  houses: Record<string, number>;
  topSurnames: Array<[string, number]>;
  historicalEchoCount: number;
  stateNameGenerationCount: number;
  echoEligibleCount: number;
  prestigeBranchCount: number;
  echoBlockedByHistoricalUseCount: number;
}

const houseCounts: Record<string, number> = {
  "HAN single": 0,
  "HAN compound": 0,
  KHITAN: 0,
  JURCHEN: 0,
  MONGOL: 0,
  MANCHU: 0,
};
const surnameCounts = new Map<string, number>();
let historicalEchoCount = 0;
let stateNameGenerationCount = 0;
let echoEligibleCount = 0;
let prestigeBranchCount = 0;
let echoBlockedByHistoricalUseCount = 0;

export function resetNameGenerationTelemetry() {
  Object.keys(houseCounts).forEach((key) => { houseCounts[key] = 0; });
  surnameCounts.clear();
  historicalEchoCount = 0;
  stateNameGenerationCount = 0;
  echoEligibleCount = 0;
  prestigeBranchCount = 0;
  echoBlockedByHistoricalUseCount = 0;
}

export function recordRuntimeHouse(culture: NameCulture, compound: boolean, surname: string) {
  const category = culture === "HAN" ? `HAN ${compound ? "compound" : "single"}` : culture;
  houseCounts[category] = (houseCounts[category] ?? 0) + 1;
  surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1);
}

export function recordStateNameGeneration(input: { echoEligible: boolean; prestigeBranch: boolean; historicalEcho: boolean; echoBlockedByHistoricalUse: boolean }) {
  stateNameGenerationCount += 1;
  if (input.echoEligible) echoEligibleCount += 1;
  if (input.prestigeBranch) prestigeBranchCount += 1;
  if (input.historicalEcho) historicalEchoCount += 1;
  if (input.echoBlockedByHistoricalUse) echoBlockedByHistoricalUseCount += 1;
}

export function getNameGenerationSummary(): NameGenerationSummary {
  return {
    houses: { ...houseCounts },
    topSurnames: [...surnameCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8),
    historicalEchoCount,
    stateNameGenerationCount,
    echoEligibleCount,
    prestigeBranchCount,
    echoBlockedByHistoricalUseCount,
  };
}
