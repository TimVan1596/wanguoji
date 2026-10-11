import { describe, expect, it } from "vitest";
import { composeRevolutionNarrative, getRevolutionEventDetails } from "./RevolutionEventDetails";
import { formatWorldDate } from "../Simulation/WorldTime";

const facts = { oldHouseName: "甲氏", newHouseName: "乙氏", newRulerName: "乙安", previousRulerTitle: "旧王甲平",
  vulnerabilityEvidence: "RECENT_CAPITAL_LOSS,RECENT_EMPIRE_SPLIT,WEAK_STATE_POSITION", displacedSuccessorName: "甲康", oldStateName: "旧国", newStateName: "新国", oldColor: 1, newColor: 2,
  crisisCapitalCityName: "旧都", crisisCapitalMonth: 520, crisisCapitalEventId: "capital", crisisSplitMonth: 500, crisisSplitEventId: "split" };

describe("夺统事件只用冻结的真实背景", () => {
  it("在旧V13展示中稳定去重旧证据码且不改写原始metadata", () => {
    const metadata = { vulnerabilityEvidence: "PREDECESSOR_COMBAT_DEATH,PREDECESSOR_COMBAT_DEATH,LOW_FACTION_STABILITY,PREDECESSOR_COMBAT_DEATH,UNKNOWN_CODE" };
    const event = { id: "old-v13-usurp", year: 483 * 12 + 7, monthIndex: 483 * 12 + 7, category: "politics" as const,
      type: "dynasty-usurped" as const, title: "郡国易代", metadata, importance: "major" as const };
    const before = JSON.stringify(event.metadata);
    const details = getRevolutionEventDetails(event as any).join("；");
    expect(details.match(/前君战死/g)).toHaveLength(1);
    expect(details.match(/国家稳定度偏低/g)).toHaveLength(1);
    expect(details).not.toContain("UNKNOWN_CODE");
    expect(JSON.stringify(event.metadata)).toBe(before);
  });

  it("保留两场不同日期和城市的失都事实，不把事件记录合并", () => {
    const text = composeRevolutionNarrative({ ...facts,
      crisisEvidence: JSON.stringify([
        { kind: "CAPITAL_LOSS", eventId: "capital-a", month: 500, cityIds: ["a"], cityNames: ["甲都"] },
        { kind: "CAPITAL_LOSS", eventId: "capital-b", month: 510, cityIds: ["b"], cityNames: ["乙都"] },
      ]),
      vulnerabilityEvidence: "RECENT_CAPITAL_LOSS,RECENT_CAPITAL_LOSS,LOW_FACTION_STABILITY", successionReason: "natural",
    });
    expect(text).toContain("甲都"); expect(text).toContain("乙都");
    expect(text.match(/失去/g)).toHaveLength(2);
  });

  it("背景按真实月份组织，不把字段顺序当作事件顺序", () => {
    const text = composeRevolutionNarrative({ ...facts, successionReason: "natural" });
    expect(text.indexOf(formatWorldDate(500))).toBeLessThan(text.indexOf(formatWorldDate(520)));
    expect(text).toContain("旧王甲平去世"); expect(text).toContain("乙安夺取王统"); expect(text).toContain("合法继承人甲康被排除");
    expect(text.match(/重大帝国分裂/g)).toHaveLength(1);
    expect(text).not.toMatch(/甲康.*被杀|权臣|将军|拥立|父子|血亲/);
  });
  it("新证据负载只叙述实际记录的单项失都或分裂", () => {
    const text = composeRevolutionNarrative({ ...facts, crisisCapitalCityName: undefined, crisisCapitalMonth: undefined,
      crisisCapitalEventId: undefined, crisisSplitMonth: undefined, crisisSplitEventId: undefined,
      crisisEvidence: JSON.stringify([{ kind: "EMPIRE_SPLIT", eventId: "split", month: 500, cityIds: ["a", "b"], cityNames: ["甲", "乙"] }]),
      vulnerabilityEvidence: "RECENT_EMPIRE_SPLIT,LOW_FACTION_STABILITY,POLITICAL_VULNERABILITY", successionReason: "natural" });
    expect(text).toContain("重大分裂，甲、乙脱离"); expect(text).not.toContain("失去旧都");
  });
  it.each([["combat", "战死"], ["captured", "被俘处死"], ["natural", "去世"]])("仅真实%s结局支持死亡用语", (reason, label) => {
    expect(composeRevolutionNarrative({ ...facts, successionReason: reason })).toContain(`旧王甲平${label}`);
  });
  it("缺少结局或来源时不补造死亡与历史冲击", () => {
    const text = composeRevolutionNarrative({ ...facts, crisisSplitEventId: undefined, vulnerabilityEvidence: "" });
    expect(text).not.toMatch(/战死|处死|去世|旧都|帝国分裂/);
    expect(text).toContain("乙氏取代甲氏");
  });
});
