import type { CityNameCategory } from "./CityNameGenerator";

export interface CityNamingSummary {
  generatedTotal: number;
  categories: Record<CityNameCategory, number>;
  topSuffixes: Array<[string, number]>;
  recentNames: string[];
}

const categoryCounts: Record<CityNameCategory, number> = {
  HISTORICAL_CITY: 0,
  HISTORICAL_REGIONAL: 0,
  STYLIZED: 0,
  GENERATED: 0,
  SINGLE: 0,
};
const suffixCounts = new Map<string, number>();
const recentNames: string[] = [];
let generatedTotal = 0;

export function resetCityNamingTelemetry() {
  (Object.keys(categoryCounts) as CityNameCategory[]).forEach((category) => { categoryCounts[category] = 0; });
  suffixCounts.clear();
  recentNames.splice(0);
  generatedTotal = 0;
}

export function recordCityNameGenerated(name: string, category: CityNameCategory) {
  generatedTotal += 1;
  categoryCounts[category] += 1;
  const suffix = [...name].at(-1);
  if (suffix) suffixCounts.set(suffix, (suffixCounts.get(suffix) ?? 0) + 1);
  recentNames.unshift(name);
  recentNames.splice(15);
}

export function getCityNamingSummary(): CityNamingSummary {
  return {
    generatedTotal,
    categories: { ...categoryCounts },
    topSuffixes: [...suffixCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8),
    recentNames: [...recentNames],
  };
}
