import { describe, expect, it } from "vitest";
import {
  getCityCameraFocusTarget,
  getGridCoordinateFromWorld,
  resolveCityAtWorld,
} from "./MapInteraction";

describe("map interaction", () => {
  it("resolves city by grid coordinate", () => {
    const city = { id: "city-xianyang" };
    const map = {
      getBlock(x: number, y: number) {
        return x === 2 && y === 3 ? { city } : undefined;
      },
    };

    expect(getGridCoordinateFromWorld(65, 97, 32)).toEqual({ x: 2, y: 3 });
    expect(resolveCityAtWorld(map, 65, 97, 32)).toBe(city);
  });

  it("returns undefined for non-city cells", () => {
    const map = {
      getBlock() {
        return { city: undefined };
      },
    };

    expect(resolveCityAtWorld(map, 10, 10, 32)).toBeUndefined();
  });

  it("keeps zoom value when calculating city focus target", () => {
    expect(getCityCameraFocusTarget(64, 96, 32, 1.75)).toEqual({
      centerX: 80,
      centerY: 112,
      zoom: 1.75,
    });
  });
});
