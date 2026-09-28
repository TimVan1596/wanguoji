import { describe, expect, it } from "vitest";
import { resolveHistoricalRulerDisplay } from "./HistoricalRulerDisplay";

const ruler = {
  houseName: "嬴氏",
  givenName: "平",
  endYear: 120,
  posthumousEpithet: "武",
  templeName: undefined,
};

describe("historical ruler display", () => {
  it("uses 王 for a deceased king", () => {
    expect(resolveHistoricalRulerDisplay(ruler, "秦", "compact", { historicalRank: "KING" })).toBe("秦武王嬴平");
  });

  it("uses 帝 for a deceased emperor", () => {
    expect(resolveHistoricalRulerDisplay(ruler, "秦", "compact", { historicalRank: "EMPEROR" })).toBe("秦武帝嬴平");
  });

  it("does not show retrospective titles for a living ruler", () => {
    expect(resolveHistoricalRulerDisplay({ ...ruler, endYear: undefined }, "秦", "compact", { historicalRank: "EMPEROR" })).toBe("嬴平");
  });
});
