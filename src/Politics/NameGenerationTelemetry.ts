import type { NameCulture } from "./NameCulture";

export interface NameGenerationSummary {
  houses: Record<string, number>;
  topSurnames: Array<[string, number]>;
  historicalEchoCount: number;
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

export function resetNameGenerationTelemetry() {
  Object.keys(houseCounts).forEach((key) => { houseCounts[key] = 0; });
  surnameCounts.clear();
  historicalEchoCount = 0;
}

export function recordRuntimeHouse(culture: NameCulture, compound: boolean, surname: string) {
  const category = culture === "HAN" ? `HAN ${compound ? "compound" : "single"}` : culture;
  houseCounts[category] = (houseCounts[category] ?? 0) + 1;
  surnameCounts.set(surname, (surnameCounts.get(surname) ?? 0) + 1);
}

export function recordHistoricalEcho() {
  historicalEchoCount += 1;
}

export function getNameGenerationSummary(): NameGenerationSummary {
  return {
    houses: { ...houseCounts },
    topSurnames: [...surnameCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8),
    historicalEchoCount,
  };
}
