import { analyzeEraSnapshot } from "./EraAtlasLayout";
import type { EraMapSnapshotV1 } from "./EraMapSnapshot";
export interface EraBorder { x1: number; y1: number; x2: number; y2: number; neutral: boolean }
const cache = new WeakMap<EraMapSnapshotV1, readonly EraBorder[]>();
/** Derived grid edges only, in cell coordinates. Each right/down edge occurs once. */
export function getEraMapBorders(snapshot: EraMapSnapshotV1): readonly EraBorder[] {
  const existing = cache.get(snapshot); if (existing) return existing;
  const owners = analyzeEraSnapshot(snapshot).owners, w = snapshot.widthCells, h = snapshot.heightCells;
  const edges: EraBorder[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const owner = owners[y * w + x];
    if (x + 1 < w && owner !== owners[y * w + x + 1])
      edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1, neutral: owner === 0 || owners[y * w + x + 1] === 0 });
    if (y + 1 < h && owner !== owners[(y + 1) * w + x])
      edges.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1, neutral: owner === 0 || owners[(y + 1) * w + x] === 0 });
  }
  cache.set(snapshot, edges); return edges;
}
