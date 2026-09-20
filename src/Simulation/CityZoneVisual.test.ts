import { describe, expect, it } from "vitest";
import {
  getCityZoneVisualState,
  getExteriorZoneEdges,
} from "./CityZoneVisual";

describe("city zone visual", () => {
  it("uses a single priority for visual state", () => {
    expect(
      getCityZoneVisualState({ underSiege: true, selected: true, hovered: true })
    ).toBe("UNDER_SIEGE");
    expect(
      getCityZoneVisualState({ underSiege: false, selected: true, hovered: true })
    ).toBe("SELECTED");
    expect(
      getCityZoneVisualState({ underSiege: false, selected: false, hovered: true })
    ).toBe("HOVERED");
  });

  it("draws only exterior edges for adjacent fortified cells", () => {
    const edges = getExteriorZoneEdges(
      [
        { x: 0, y: 0 },
        { x: 32, y: 0 },
      ],
      32
    );

    expect(edges).toHaveLength(6);
    expect(edges).not.toContainEqual({ x1: 32, y1: 0, x2: 32, y2: 32 });
  });
});
