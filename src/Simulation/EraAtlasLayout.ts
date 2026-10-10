import { decodeOwnerRuns, type EraMapSnapshotV1 } from "./EraMapSnapshot";
export interface EraTerritoryRow { factionId: string; displayName: string; color: number; controlledCells: number; worldShare: number; cityCount: number; paletteIndex: number }
export interface EraAtlasAnalysis { owners: number[]; components: Int32Array; depth: Int32Array; candidates: Map<number, number[]>; territories: EraTerritoryRow[] }
const cache = new WeakMap<EraMapSnapshotV1, EraAtlasAnalysis>();
const stable = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
/** Derived arrays only: immutable snapshot identity is the lifetime of this cache. */
export function analyzeEraSnapshot(snapshot: EraMapSnapshotV1): EraAtlasAnalysis {
  const existing = cache.get(snapshot); if (existing) return existing;
  const { widthCells: w } = snapshot, owners = decodeOwnerRuns(snapshot), n = owners.length;
  const components = new Int32Array(n), depth = new Int32Array(n), queue = new Int32Array(n);
  const sizes = new Map<number, number>(), largest = new Map<number, number>(); let component = 0;
  const neighbors = (i: number) => [i % w > 0 ? i - 1 : -1, i % w < w - 1 ? i + 1 : -1, i >= w ? i - w : -1, i < n - w ? i + w : -1];
  for (let seed = 0; seed < n; seed++) {
    if (!owners[seed] || components[seed]) continue;
    component++; let head = 0, tail = 0; queue[tail++] = seed; components[seed] = component;
    while (head < tail) { const i = queue[head++]; for (const j of neighbors(i)) if (j >= 0 && !components[j] && owners[j] === owners[seed]) { components[j] = component; queue[tail++] = j; } }
    sizes.set(component, tail);
    if (tail > (sizes.get(largest.get(owners[seed]) ?? 0) ?? 0)) largest.set(owners[seed], component);
  }
  // Multi-source distance from the actual component edge, never a mean of islands.
  let head = 0, tail = 0;
  for (let i = 0; i < n; i++) if (components[i] && neighbors(i).some(j => j < 0 || components[j] !== components[i])) { depth[i] = 1; queue[tail++] = i; }
  while (head < tail) { const i = queue[head++]; for (const j of neighbors(i)) if (j >= 0 && components[j] === components[i] && !depth[j]) { depth[j] = depth[i] + 1; queue[tail++] = j; } }
  const candidates = new Map<number, number[]>();
  owners.forEach((owner, i) => { if (owner && components[i] === largest.get(owner)) { const list = candidates.get(owner) ?? []; list.push(i); candidates.set(owner, list); } });
  candidates.forEach(list => list.sort((a, b) => depth[b] - depth[a] || a - b));
  const counts = new Map<number, number>(), cities = new Map<string, number>();
  owners.forEach(i => counts.set(i, (counts.get(i) ?? 0) + 1));
  snapshot.cities.forEach(c => { if (c.ownerFactionId) cities.set(c.ownerFactionId, (cities.get(c.ownerFactionId) ?? 0) + 1); });
  const territories = snapshot.factionPalette.map((f, i) => ({ ...f, paletteIndex: i + 1, controlledCells: counts.get(i + 1) ?? 0,
    worldShare: n ? (counts.get(i + 1) ?? 0) / n : 0, cityCount: cities.get(f.factionId) ?? 0 }))
    .sort((a, b) => b.controlledCells - a.controlledCells || stable(a.factionId, b.factionId));
  const analysis = { owners, components, depth, candidates, territories }; cache.set(snapshot, analysis); return analysis;
}
export interface EraCountryLabel { factionId: string; text: string; x: number; y: number; fontSize: number; left: number; top: number; right: number; bottom: number }
/** Text rectangles must stay entirely in the largest owned component. */
export function layoutEraCountryLabels(snapshot: EraMapSnapshotV1, cellSize: number, full: boolean,
  measure: (text: string, fontSize: number) => number = (text, font) => Array.from(text).length * font): EraCountryLabel[] {
  const a = analyzeEraSnapshot(snapshot), w = snapshot.widthCells, h = snapshot.heightCells;
  const labels: EraCountryLabel[] = [];
  const reserves = snapshot.cities.filter(c => c.isCapital).map(c => ({ x: (c.gridX + .5) * cellSize, y: (c.gridY + .5) * cellSize }));
  for (const row of (full ? a.territories : a.territories.slice(0, 4))) {
    if (!row.controlledCells || !row.displayName) continue;
    const candidates = (a.candidates.get(row.paletteIndex) ?? []).slice(0, 512);
    if (candidates.length < (full ? 4 : 16)) continue;
    let placed = false;
    for (let font = full ? Math.min(28, Math.floor(cellSize * 1.4)) : 11; font >= (full ? 10 : 8) && !placed; font -= 2) {
      const halfWidth = (measure(row.displayName, font) + 6) / 2, halfHeight = (font * 1.3 + 4) / 2;
      for (const i of candidates) {
        const x = (i % w + .5) * cellSize, y = (Math.floor(i / w) + .5) * cellSize;
        const box = { left: x - halfWidth, right: x + halfWidth, top: y - halfHeight, bottom: y + halfHeight };
        if (box.left < 0 || box.right > w * cellSize || box.top < 0 || box.bottom > h * cellSize) continue;
        if (reserves.some(p => p.x + cellSize * .65 > box.left && p.x - cellSize * .65 < box.right && p.y + cellSize * .65 > box.top && p.y - cellSize * .65 < box.bottom)) continue;
        if (labels.some(p => p.left < box.right && p.right > box.left && p.top < box.bottom && p.bottom > box.top)) continue;
        let fits = true;
        for (let yy = Math.floor(box.top / cellSize); yy <= Math.floor((box.bottom - .001) / cellSize) && fits; yy++)
          for (let xx = Math.floor(box.left / cellSize); xx <= Math.floor((box.right - .001) / cellSize); xx++)
            if (a.components[yy * w + xx] !== a.components[i]) { fits = false; break; }
        if (!fits) continue;
        labels.push({ ...box, factionId: row.factionId, text: row.displayName, x, y, fontSize: font }); placed = true; break;
      }
    }
  }
  return labels;
}
