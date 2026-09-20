import { describe, expect, it } from "vitest";
import { calculateInitialFactionExposure } from "./InitialFactionExposure";

describe("initial faction exposure", () => {
  it("deterministically summarizes nearby opponent exposure", () => {
    const exposure = calculateInitialFactionExposure(
      [
        { name: "秦", x: 0, y: 0 },
        { name: "韩", x: 3, y: 4 },
        { name: "燕", x: 30, y: 0 },
      ],
      6
    );
    expect(exposure.find((item) => item.factionId === "秦")).toEqual({
      factionId: "秦",
      nearbyOpponentCount: 1,
      nearestOpponentDistance: 5,
    });
    expect(exposure.find((item) => item.factionId === "燕")?.nearbyOpponentCount).toBe(0);
  });
});
