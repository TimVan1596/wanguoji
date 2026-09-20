import { describe, expect, it } from "vitest";
import { getRegimeStyleNameAtMonth } from "./RegimeStyle";

describe("regime style", () => {
  it("formats king and emperor eras without mutating displayName", () => {
    const faction = {
      name: "zheng_1",
      displayName: "郑",
      identityStage: "STATE" as const,
      stateFoundedMonth: 100,
      sovereigntyRank: "EMPEROR" as const,
      sovereigntyHistory: [
        { rank: "KING" as const, startMonth: 100, endMonth: 199 },
        { rank: "EMPEROR" as const, startMonth: 200 },
      ],
      nameHistory: [{ name: "郑", startMonth: 100, reason: "state" }],
    };
    expect(getRegimeStyleNameAtMonth(faction, 150)).toBe("郑国");
    expect(getRegimeStyleNameAtMonth(faction, 220)).toBe("郑朝");
    expect(faction.displayName).toBe("郑");
  });
});
