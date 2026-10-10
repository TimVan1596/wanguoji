import { describe, expect, it, vi } from "vitest";
import { placeEraCityLabel } from "./EraCityLabelLayout";
import { renderEraMapSnapshot } from "./EraMapRenderer";
import { encodeOwnerRuns } from "./EraMapSnapshot";
import worldRandom from "./WorldRandom";

describe("bounded historical city labels", () => {
  it.each([[9, 9], [171, 9], [9, 171], [171, 171]])("contains the outline at edge marker %s,%s", (x, y) => {
    const marker = { left: x - 8, top: y - 8, right: x + 8, bottom: y + 8 };
    const label = placeEraCityLabel(x, y, 30, 12, 180, 180, 8, [marker])!;
    expect(label).toBeDefined(); expect(label.left).toBeGreaterThanOrEqual(2); expect(label.top).toBeGreaterThanOrEqual(2);
    expect(label.right).toBeLessThanOrEqual(178); expect(label.bottom).toBeLessThanOrEqual(178);
    expect(label.left >= marker.right || label.right <= marker.left || label.top >= marker.bottom || label.bottom <= marker.top).toBe(true);
    expect(placeEraCityLabel(x, y, 30, 12, 180, 180, 8, [marker])).toEqual(label);
  });
  it("hides impossible text and occupied placements without moving cities", () => {
    expect(placeEraCityLabel(9, 9, 200, 12, 180, 180, 8)).toBeUndefined();
    expect(placeEraCityLabel(9, 9, 30, 12, 180, 180, 8, [{ left: 0, top: 0, right: 180, bottom: 180 }])).toBeUndefined();
  });
  it("keeps all capital rings and city points at frozen coordinates; labels and RNG/save data remain deterministic", () => {
    const cities = [[0, 0], [9, 0], [0, 9], [9, 9]].map(([gridX, gridY], i) => ({ cityId: `c${i}`, name: `城${i}`, gridX, gridY, isCapital: true }));
    const snapshot = { version: 1 as const, capturedMonth: 100, widthCells: 10, heightCells: 10,
      factionPalette: [{ factionId: "a", displayName: "旧国", color: 0xaa0000 }], ownerRuns: encodeOwnerRuns(Array(100).fill(1)), cities };
    const before = JSON.stringify(snapshot), rng = worldRandom.exportState();
    const context = { canvas: { width: 0, height: 0 }, fillRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
      measureText: (text: string) => ({ width: text.length * 9, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 2 }), strokeText: vi.fn(), fillText: vi.fn() } as any;
    renderEraMapSnapshot(context, snapshot, { cellSize: 18, showCities: true, showLabels: true });
    for (const c of cities) {
      expect(context.arc).toHaveBeenCalledWith((c.gridX + .5) * 18, (c.gridY + .5) * 18, 7.2, 0, Math.PI * 2);
      const call = context.fillText.mock.calls.find((args: any[]) => args[0] === c.name);
      expect(call).toBeDefined(); const [, x, baseline] = call;
      expect(x).toBeGreaterThanOrEqual(2); expect(x + 18).toBeLessThanOrEqual(178);
      expect(baseline - 9).toBeGreaterThanOrEqual(2); expect(baseline + 2).toBeLessThanOrEqual(178);
    }
    expect(JSON.stringify(snapshot)).toBe(before); expect(worldRandom.exportState()).toEqual(rng);
    const first = context.fillText.mock.calls.slice(); context.fillText.mockClear();
    renderEraMapSnapshot(context, JSON.parse(before), { cellSize: 18, showCities: true, showLabels: true });
    expect(context.fillText.mock.calls).toEqual(first);
  });
});
