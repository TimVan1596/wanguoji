import { describe, expect, it, vi } from "vitest";
import {
  buildGenealogyOnDemand,
  clampGenealogyScale,
  getGenealogyCanvasLayout,
  getGenealogyFitScale,
  GENEALOGY_SCALE_STEP,
} from "./genealogyViewport";

describe("genealogy viewport controls", () => {
  it("does not build the tree while the full genealogy dialog is closed", () => {
    const build = vi.fn(() => ["tree"]);
    expect(buildGenealogyOnDemand(false, build)).toBeUndefined();
    expect(build).not.toHaveBeenCalled();
    expect(buildGenealogyOnDemand(true, build)).toEqual(["tree"]);
    expect(build).toHaveBeenCalledTimes(1);
  });
  it("clamps zoom to the supported 50%-160% range", () => {
    expect(clampGenealogyScale(0.1)).toBe(0.5);
    expect(clampGenealogyScale(1.234)).toBe(1.23);
    expect(clampGenealogyScale(2)).toBe(1.6);
    expect(GENEALOGY_SCALE_STEP).toBe(0.1);
  });

  it("fits the whole tree within the viewport when possible and respects minimum zoom", () => {
    expect(getGenealogyFitScale(1600, 900, 800, 450)).toBe(0.5);
    expect(getGenealogyFitScale(300, 200, 800, 450)).toBe(1.6);
    expect(getGenealogyFitScale(0, 200, 800, 450)).toBe(1);
  });

  it("centers a small tree and preserves scrollable dimensions for a large tree", () => {
    expect(getGenealogyCanvasLayout(300, 100, 800, 500, 1)).toEqual({
      width: 800, height: 500, left: 250, top: 200,
    });
    expect(getGenealogyCanvasLayout(1200, 700, 800, 500, 1)).toEqual({
      width: 1200, height: 700, left: 0, top: 0,
    });
  });
});
