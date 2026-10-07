import { CURRENT_SAVE_SCHEMA_VERSION, type WorldSaveV9 } from "./WorldSaveSchema";

export interface HydrationRepairs {
  staleArchivedCityBlockRefs: number; cityIds: string[]; summary: string;
  unresolvedCityBlockRefs: Array<{ gridX: number; gridY: number; owner?: string; cityId: string }>;
  activeCityIds: string[]; archivedCityIds: string[];
}
/** Narrow V9 normalization on a clone. Strict validation still runs on the result.
 * Repository admission may inspect this clone but must return the original stored record. */
export function normalizeArchivedCityBlockRefs(value: unknown): { value: unknown; repairs: HydrationRepairs } {
  const repairs: HydrationRepairs = { staleArchivedCityBlockRefs: 0, cityIds: [], summary: "stale archived city refs repaired: 0",
    unresolvedCityBlockRefs: [], activeCityIds: [], archivedCityIds: [] };
  if (!value || typeof value !== "object") return { value, repairs };
  const save = value as WorldSaveV9;
  if (save.saveSchemaVersion !== CURRENT_SAVE_SCHEMA_VERSION || !Array.isArray(save.blocks) || !Array.isArray(save.cities)
    || !Array.isArray(save.registries?.archivedCities)) return { value, repairs };
  const active = new Set(save.cities.filter(city => city && typeof city.cityId === "string").map(city => city.cityId));
  const archived = new Set((save.registries.archivedCities as Array<Record<string, unknown>>).filter(city => city && typeof city.id === "string"
    && typeof city.destroyedMonth === "number" && Number.isFinite(city.destroyedMonth) && city.destroyedMonth >= 0
    && city.destroyedMonth <= save.world?.worldMonth && typeof city.foundedMonth === "number" && city.foundedMonth <= city.destroyedMonth
    && Array.isArray(city.history)).map(city => String(city.id)));
  repairs.activeCityIds = [...active].slice(0, 100); repairs.archivedCityIds = [...archived].slice(0, 100);
  const repairIds = new Set<string>();
  for (const block of save.blocks) {
    if (!block || typeof block.cityId !== "string" || active.has(block.cityId)) continue;
    if (archived.has(block.cityId)) { repairs.staleArchivedCityBlockRefs++; repairIds.add(block.cityId); }
    else if (repairs.unresolvedCityBlockRefs.length < 20) repairs.unresolvedCityBlockRefs.push({ gridX: block.gridX, gridY: block.gridY, owner: block.ownerFactionId, cityId: block.cityId });
  }
  repairs.cityIds = [...repairIds]; repairs.summary = `stale archived city refs repaired: ${repairs.staleArchivedCityBlockRefs}`;
  if (!repairs.staleArchivedCityBlockRefs) return { value, repairs };
  const clone = structuredClone(save);
  clone.blocks.forEach(block => {
    if (typeof block.cityId === "string" && !active.has(block.cityId) && archived.has(block.cityId)) {
      delete block.cityId; block.isCityCenter = false; block.isHome = false; block.homeHitPoints = 0;
    }
  });
  return { value: clone, repairs };
}
