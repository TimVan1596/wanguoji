import type { FactionSaveV1 } from "./WorldSaveSchema";

/** V12 permanent records are checked before any hydration teardown. */
export function validateFactionLifetime(value: unknown, factions: FactionSaveV1[], worldMonth: number,
  totalWorldBlocks: number): string[] {
  const errors: string[] = [];
  const object = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v));
  const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
  if (!object(value) || !integer(value.totalWorldBlocks) || value.totalWorldBlocks !== totalWorldBlocks || !Array.isArray(value.records)) {
    return ["invalid factionLifetime geometry or records"];
  }
  const byId = new Map(factions.map(faction => [faction.factionId, faction]));
  const seen = new Set<string>();
  for (const record of value.records) {
    if (!object(record) || typeof record.factionId !== "string" || !byId.has(record.factionId) || seen.has(record.factionId)) {
      errors.push("invalid or duplicate factionLifetime factionId"); continue;
    }
    seen.add(record.factionId);
    const faction = byId.get(record.factionId)!;
    const endMonth = faction.terminationMonth ?? faction.extinctionMonth;
    if (!integer(record.lastObservedMonth) || record.lastObservedMonth > worldMonth || record.lastObservedMonth < faction.firstFoundedMonth) errors.push("invalid factionLifetime lastObservedMonth");
    for (const key of ["peakPopulation", "peakTerritoryBlocks", "peakCityCount"] as const) {
      const peak = record[key];
      if (!object(peak) || !integer(peak.value) || !integer(peak.month) || !["MONTHLY", "PRE_TERMINAL"].includes(String(peak.source)) || peak.month < faction.firstFoundedMonth || peak.month > Number(record.lastObservedMonth) ||
        (key === "peakTerritoryBlocks" && Number(peak.value) > totalWorldBlocks)) errors.push(`invalid factionLifetime ${key}`);
    }
    if (faction.status === "EXTINCT") {
      const t = record.terminal;
      if (!object(t) || !integer(t.month) || t.month !== endMonth || t.month !== record.lastObservedMonth || t.month > worldMonth || t.month < faction.firstFoundedMonth) {
        errors.push("invalid factionLifetime terminal month"); continue;
      }
      for (const [field, peakKey] of [["population", "peakPopulation"], ["territoryBlocks", "peakTerritoryBlocks"], ["cityCount", "peakCityCount"]]) {
        if (!integer(t[field]) || !object(record[peakKey]) || Number(t[field]) > Number((record[peakKey] as Record<string, unknown>).value)) errors.push("invalid factionLifetime terminal value");
      }
    } else if (record.terminal !== undefined) errors.push("non-terminal faction cannot have a frozen factionLifetime record");
  }
  if (seen.size !== byId.size) errors.push("every faction requires a factionLifetime record");
  return errors;
}
