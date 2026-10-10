import { describe, expect, it } from "vitest";
import { resolveHistoricalRulerDisplay } from "./HistoricalRulerDisplay";

const ruler = {
  houseName: "嬴氏",
  givenName: "平",
  endYear: 120,
  deathMonth: 120,
  deathReason: "去世" as const,
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

  it("shows the current formal ruler's polity and rank without inventing a posthumous title", () => {
    expect(resolveHistoricalRulerDisplay({ ...ruler, endYear: undefined, deathMonth: undefined, deathReason: undefined, posthumousEpithet: undefined }, "党", "compact", { historicalRank: "KING" })).toBe("党王嬴平");
    expect(resolveHistoricalRulerDisplay({ ...ruler, endYear: undefined, deathMonth: undefined, deathReason: undefined, posthumousEpithet: undefined }, "燕", "compact", { historicalRank: "EMPEROR" })).toBe("燕帝嬴平");
  });

  it("uses the historical provisional faction and leader role", () => {
    expect(resolveHistoricalRulerDisplay({ ...ruler, endYear: undefined }, "新郑义军", "compact", { historicalRank: "LEADER" })).toBe("新郑义军首领嬴平");
  });

  it("adds the polity and rank when a deceased ruler has no posthumous epithet", () => {
    expect(resolveHistoricalRulerDisplay({ ...ruler, posthumousEpithet: undefined }, "党", "compact", { historicalRank: "KING" })).toBe("党王嬴平");
  });
});
