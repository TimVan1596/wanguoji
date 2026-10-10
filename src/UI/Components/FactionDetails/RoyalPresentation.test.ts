import { describe, expect, it } from "vitest";
import { getHouseEpochHeading, getHouseEpochPresentation, getSignificantReignStats, formatRulerAge, formatRulerLifeAge } from "./RoyalPresentation";
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

// All terminal reasons retain EXTINCT as the faction lifecycle status.
describe("terminal house epoch title", () => {
  it.each(["EXTINCT", "MERGED", "SUBMITTED"])("%s displays the actual last epoch as the final house", terminationReason => {
    const faction = { status: "EXTINCT", terminationReason, houseName: "姬氏" };
    const epochs: DynastyHouseEpoch[] = [first, { houseName: "张氏", startMonth: 100, foundingRulerId: "last", startReason: "USURPATION" }];
    expect(getHouseEpochHeading(faction.status)).toBe("末代王统");
    expect(getHouseEpochPresentation(epochs).current?.text).toContain("张氏");
    expect(getHouseEpochPresentation(epochs).current?.key).toBe("last");
  });
  it.each(["ACTIVE", "EXILED"])("%s retains a current house, not a prematurely final one", status => {
    expect(getHouseEpochHeading(status)).toBe("当前王统");
  });
});

it("uses only actual death for lifetime age and freezes politically ended/retired ages", () => {
  const ruler = { bornYear: 0, endYear: 528, status: "politically-ended" as const };
  expect(formatRulerLifeAge(ruler, 1200)).toBe("政治任期终结时44岁 · 生死未载");
  expect(formatRulerLifeAge(ruler, 2400)).toBe(formatRulerLifeAge(ruler, 1200));
  expect(formatRulerLifeAge({ ...ruler, status: "abdicated" }, 1200)).toBe("退位时44岁");
  expect(formatRulerLifeAge({ ...ruler, status: "dead", deathMonth: 600, deathReason: "去世" }, 1200)).toBe("享年50岁");
  expect(formatRulerLifeAge({ ...ruler, status: "dead" }, 1200)).not.toContain("享年");
});
