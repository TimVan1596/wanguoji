import { describe, expect, it, vi } from "vitest";
import { renderEraMapSnapshot } from "./EraMapRenderer";
import type { EraMapSnapshotV1 } from "./EraMapSnapshot";

describe("EraMapRenderer", () => {
  it("renders only the frozen snapshot into a canvas and labels cities in full mode", () => {
    const calls: unknown[][] = [];
    const context = {
      canvas: { width: 0, height: 0 },
      fillRect: vi.fn((...args: unknown[]) => calls.push(["fillRect", ...args])),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      strokeText: vi.fn(),
      fillText: vi.fn(),
    } as any;
    const snapshot: EraMapSnapshotV1 = {
      version: 1,
      capturedMonth: 12,
      widthCells: 2,
      heightCells: 1,
      factionPalette: [{ factionId: "秦", displayName: "秦", color: 0xaa0000 }],
      ownerRuns: [{ paletteIndex: 1, length: 1 }, { paletteIndex: 0, length: 1 }],
      cities: [{ cityId: "c", name: "咸阳", gridX: 0, gridY: 0, ownerFactionId: "秦", founderFactionId: "秦", isCapital: true }],
    };

    renderEraMapSnapshot(context, snapshot, { cellSize: 18, showCities: true });

    expect(context.canvas).toEqual({ width: 36, height: 18 });
    expect(calls).toContainEqual(["fillRect", 0, 0, 18, 18]);
    expect(context.fillText).toHaveBeenCalledWith("咸阳", expect.any(Number), expect.any(Number));
  });
});
