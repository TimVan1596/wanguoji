import { describe, expect, it } from "vitest";
import { composeRevolutionNarrative } from "./RevolutionEventDetails";
import { formatWorldDate } from "../Simulation/WorldTime";

const facts = { oldHouseName: "甲氏", newHouseName: "乙氏", newRulerName: "乙安", previousRulerTitle: "旧王甲平",
  displacedSuccessorName: "甲康", oldStateName: "旧国", newStateName: "新国", oldColor: 1, newColor: 2,
  crisisCapitalCityName: "旧都", crisisCapitalMonth: 520, crisisCapitalEventId: "capital", crisisSplitMonth: 500, crisisSplitEventId: "split" };

describe("夺统事件只用冻结的真实背景", () => {
  it("背景按真实月份组织，不把字段顺序当作事件顺序", () => {
    const text = composeRevolutionNarrative({ ...facts, successionReason: "natural" });
    expect(text.indexOf(formatWorldDate(500))).toBeLessThan(text.indexOf(formatWorldDate(520)));
    expect(text).toContain("旧王甲平去世"); expect(text).toContain("乙安夺取王统"); expect(text).toContain("合法继承人甲康被排除");
    expect(text).not.toMatch(/甲康.*被杀|权臣|将军|拥立|父子|血亲/);
  });
  it.each([["combat", "战死"], ["captured", "被俘处死"], ["natural", "去世"]])("仅真实%s结局支持死亡用语", (reason, label) => {
    expect(composeRevolutionNarrative({ ...facts, successionReason: reason })).toContain(`旧王甲平${label}`);
  });
  it("缺少结局或来源时不补造死亡与历史冲击", () => {
    const text = composeRevolutionNarrative({ ...facts, crisisSplitEventId: undefined });
    expect(text).not.toMatch(/战死|处死|去世|旧都|帝国分裂/);
    expect(text).toContain("乙氏取代甲氏");
  });
});
