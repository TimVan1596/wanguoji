import { describe, expect, it } from "vitest";
import { getHouseEpochPresentation, getSignificantReignStats, formatRulerAge } from "./RoyalPresentation";
import type { DynastyHouseEpoch } from "../../../Politics/DynasticRevolution";

const first: DynastyHouseEpoch = { houseName: "姬氏", startMonth: 0, foundingRulerId: "r1", startReason: "FOUNDING" };
describe("royal presentation without canonical mutations", () => {
  it("shows one current epoch without an empty historical section", () => {
    expect(getHouseEpochPresentation([])).toEqual({ current: undefined, historical: [] });
    expect(getHouseEpochPresentation([first])).toEqual({ current: { key: "r1", text: "姬氏 · 0年1月起 · 开创" }, historical: [] });
  });
  it("shows the latest epoch once and closed history with full month ranges", () => {
    const epochs: DynastyHouseEpoch[] = [{ ...first, endMonth: 5277 },
      { houseName: "廖氏", startMonth: 5278, foundingRulerId: "r2", startReason: "NATURAL_HOUSE_SUCCESSION" }];
    const before = JSON.stringify(epochs);
    expect(getHouseEpochPresentation(epochs)).toEqual({ current: { key: "r2", text: "廖氏 · 439年11月起 · 易姓续统" },
      historical: [{ key: "r1", text: "姬氏 · 0年1月～439年10月 · 开创" }] });
    expect(JSON.stringify(epochs)).toBe(before);
    expect(getHouseEpochPresentation([{ ...first, startReason: "USURPATION" }]).current?.text).toContain("篡朝");
  });
  it("hides zero rare statistics without modifying assessment evidence", () => {
    const stats = { citiesCapturedPersonally: 0, citiesLostDuringReign: 0, rebellionsDuringReign: 0, restorationsDuringReign: 0 };
    expect(getSignificantReignStats(stats)).toBe("暂无显著在位统计");
    expect(getSignificantReignStats({ ...stats, citiesLostDuringReign: 2, rebellionsDuringReign: 1 })).toBe("失城：2 · 内乱：1");
    expect(getSignificantReignStats({ ...stats, restorationsDuringReign: 1 })).toBe("复国：1");
    expect(stats.restorationsDuringReign).toBe(0);
  });
});

it("distinguishes death, abdication and current age without inferring death from a reign end", () => {
  expect(formatRulerAge("abdicated", 44)).toBe("退位时44岁");
  expect(formatRulerAge("dead", 44)).toBe("享年44岁");
  expect(formatRulerAge("ruling", 44)).toBe("当前年龄44岁");
  expect(formatRulerAge("exiled", 44)).toBe("当前年龄44岁");
});
