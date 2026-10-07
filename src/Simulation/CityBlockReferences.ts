interface CityRef { id: string; fortifiedCells: readonly unknown[] }
interface BlockRef { city?: CityRef; isCityCenter?: boolean }
/** Checks the existing active-city authority, never invents or sanitizes ownership. */
export function getCityBlockReferenceIssues(cities: readonly CityRef[], columns: readonly (readonly BlockRef[])[]) {
  const active = new Map(cities.map(city => [city.id, city]));
  const zones = new Map(cities.map(city => [city, new Set(city.fortifiedCells)]));
  const issues: string[] = [];
  columns.forEach((column, x) => column.forEach((block, y) => {
    if (!block.city) { if (block.isCityCenter) issues.push(`City center without active city at ${x},${y}`); return; }
    const city = active.get(block.city.id);
    if (!city || city !== block.city) issues.push(`Cannot export block reference to non-active city ${block.city.id} at ${x},${y}`);
    else if (!zones.get(city)!.has(block)) issues.push(`Block ${x},${y} references city ${city.id} outside its fortifiedCells`);
  }));
  return issues;
}
