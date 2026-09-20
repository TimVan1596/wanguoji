import { describe, expect, it } from "vitest";
import {
  formatRulerTitleAtMonth,
  getRulerTitleAtMonth,
  getNaturalDeathVerbForTitle,
  getSuccessionVerbForTitle,
} from "./RulerTitleRules";

describe("ruler title rules", () => {
  it("uses leader for rebel provisional rulers", () => {
    expect(
      getRulerTitleAtMonth(
        {
          name: "rebel_1",
          displayName: "大梁义军",
          identityStage: "PROVISIONAL",
        },
        40
      )
    ).toBe("首领");
  });

  it("uses leader for split provisional rulers", () => {
    expect(
      getRulerTitleAtMonth(
        {
          name: "split_1",
          displayName: "平阳义军",
          identityStage: "PROVISIONAL",
        },
        80
      )
    ).toBe("首领");
  });

  it("uses king for initial formal states", () => {
    expect(
      getRulerTitleAtMonth(
        {
          name: "秦",
          displayName: "秦",
          identityStage: "STATE",
          stateFoundedMonth: 0,
        },
        12
      )
    ).toBe("王");
  });

  it("resolves pre-state and post-state historical titles by month", () => {
    const faction = {
      name: "rebel_17",
      displayName: "梁",
      identityStage: "STATE",
      stateFoundedMonth: 63,
      sovereigntyRank: "EMPEROR" as const,
      sovereigntyHistory: [
        { rank: "LEADER" as const, startMonth: 10, endMonth: 62 },
        { rank: "KING" as const, startMonth: 63, endMonth: 119 },
        { rank: "EMPEROR" as const, startMonth: 120 },
      ],
      nameHistory: [
        { name: "大梁义军", startMonth: 10, endMonth: 62, reason: "initial" },
        { name: "梁", startMonth: 63, reason: "state-formation" },
      ],
    };
    expect(formatRulerTitleAtMonth(faction, "魏安", 40)).toBe("大梁义军首领魏安");
    expect(formatRulerTitleAtMonth(faction, "魏安", 70)).toBe("梁王魏安");
    expect(formatRulerTitleAtMonth(faction, "魏安", 150)).toBe("梁帝魏安");
  });

  it("uses succession wording that matches the political title", () => {
    expect(getSuccessionVerbForTitle("首领")).toBe("继任");
    expect(getSuccessionVerbForTitle("王")).toBe("继位");
    expect(getSuccessionVerbForTitle("帝")).toBe("即位");
    expect(getNaturalDeathVerbForTitle("帝")).toBe("崩");
  });
});
