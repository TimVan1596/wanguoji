import { describe, expect, it, vi } from "vitest";
import { getEraMapBorders } from "./EraMapBorders";
import { renderEraMapSnapshot } from "./EraMapRenderer";
import { encodeOwnerRuns, type EraMapSnapshotV1 } from "./EraMapSnapshot";
import worldRandom from "./WorldRandom";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
function snapshot(owners: number[], w = 3): EraMapSnapshotV1 {
  return { version: 1, capturedMonth: 100, widthCells: w, heightCells: owners.length / w,
    factionPalette: [{ factionId: "a", displayName: "旧甲", color: 0xaa0000 }, { factionId: "b", displayName: "旧乙", color: 0x00aa00 }],
    ownerRuns: encodeOwnerRuns(owners), cities: [] };
}
describe("frozen owner grid borders", () => {
  it("draws only distinct owner neighbors and differentiates neutral edges", () => {
    const s = snapshot([1, 1, 2, 1, 0, 2]);
    expect(getEraMapBorders(s)).toEqual([
      { x1: 2, y1: 0, x2: 2, y2: 1, neutral: false },
      { x1: 1, y1: 1, x2: 2, y2: 1, neutral: true },
      { x1: 1, y1: 1, x2: 1, y2: 2, neutral: true },
      { x1: 2, y1: 1, x2: 2, y2: 2, neutral: true },
    ]);
    expect(getEraMapBorders(snapshot(Array(600).fill(1), 30))).toEqual([]);
    expect(getEraMapBorders(snapshot(Array(600).fill(0), 30))).toEqual([]);
  });
  it("emits each right/down edge once, inside the canvas, with deterministic hydration cache rebuilding", () => {
    const s = snapshot(Array.from({ length: 400 }, (_, i) => i % 3), 20), before = JSON.stringify(s), rng = worldRandom.exportState();
    const borders = getEraMapBorders(s);
    expect(new Set(borders.map(e => `${e.x1},${e.y1},${e.x2},${e.y2}`)).size).toBe(borders.length);
    for (const e of borders) for (const [x, y] of [[e.x1, e.y1], [e.x2, e.y2]]) {
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(20);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(20);
    }
    expect(getEraMapBorders(s)).toBe(borders);
    expect(getEraMapBorders(JSON.parse(before))).toEqual(borders);
    expect(JSON.stringify(s)).toBe(before); expect(worldRandom.exportState()).toEqual(rng); expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(13);
  });
  it("batches borders after territory fills, before labels and capital rings; OFF retains the exact pure-color path", () => {
    const s = snapshot(Array.from({ length: 400 }, (_, i) => i % 20 < 10 ? 1 : 2), 20);
    s.cities = [{ cityId: "capital", name: "都", gridX: 0, gridY: 0, isCapital: true }];
    const calls: string[] = [];
    const context = { canvas: { width: 0, height: 0 }, fillRect: vi.fn(() => calls.push('territory')),
      beginPath: vi.fn(), moveTo: vi.fn(() => calls.push('border')), lineTo: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
      arc: vi.fn(() => calls.push('city')), measureText: (s: string) => ({ width: s.length * 10 }),
      fillText: vi.fn(() => calls.push('label')), strokeText: vi.fn() } as any;
    const before = JSON.stringify(s);
    renderEraMapSnapshot(context, s, { cellSize: 18, showBorders: true, showLabels: true, showCities: true, borderWidth: 2 });
    expect(context.moveTo).toHaveBeenCalledTimes(20); expect(context.lineTo).toHaveBeenCalledTimes(20);
    expect(calls.lastIndexOf('territory')).toBeLessThan(calls.indexOf('border'));
    expect(calls.lastIndexOf('border')).toBeLessThan(calls.indexOf('label'));
    expect(calls.lastIndexOf('border')).toBeLessThan(calls.indexOf('city'));
    expect(context.arc).toHaveBeenCalledWith(9, 9, 7.2, 0, Math.PI * 2);
    const painted = context.fillRect.mock.calls.slice(); context.fillRect.mockClear(); context.moveTo.mockClear();
    renderEraMapSnapshot(context, s, { cellSize: 18, showBorders: false, showLabels: true, showCities: true });
    expect(context.moveTo).not.toHaveBeenCalled(); expect(context.fillRect.mock.calls).toEqual(painted); expect(JSON.stringify(s)).toBe(before);
  });
});
