import { describe, expect, it, vi } from "vitest";
import type { WorldEvent } from "../History/WorldHistory";
import { derivePoliticalSuccessionShocks } from "./PoliticalSuccessionCrisis";
import { evaluateDynasticRevolution, type RevolutionContext } from "./DynasticRevolution";
import { RevolutionGateDiagnostics } from "./RevolutionGateDiagnostics";
import worldRandom from "../Simulation/WorldRandom";
const predecessor = { id: "old", houseName: "田氏", givenName: "平", bornYear: 0, accessionYear: 200, status: "dead" as const };
const capital = (): WorldEvent => ({ id: "capital", year: 500, monthIndex: 500, type: "capital-fallen", category: "war", importance: "major", title: "失都", factionIds: ["state", "enemy"],
  actorFactionId: "enemy", targetFactionId: "state", previousOwnerFactionId: "state", cityId: "former-capital", cityName: "旧都", historyGroupId: "battle", metadata: { wasCapital: 1 } });
const split = (): WorldEvent => ({ id: "split", year: 520, type: "empire-split", category: "politics", importance: "major", title: "分裂", factionIds: ["state", "rebel"],
  actorFactionId: "rebel", targetFactionId: "state", historyGroupId: "split-group", metadata: { parentFactionId: "state", foundingCityIds: "a,b", splitCityCount: 2 } });
const context = (events = [capital(), split()]): RevolutionContext => ({ worldMonth: 600, factionId: "state", predecessor,
  successor: { id: "heir", houseName: "田氏", givenName: "安", bornYear: 250, status: "heir" }, previousSuccessionMonths: [],
  successionReason: "natural", identityStage: "STATE", status: "ACTIVE", stability: 30, cityCount: 2,
  politicalShocks: derivePoliticalSuccessionShocks("state", predecessor, 600, events) });

describe("有来源的独立失都与分裂危机", () => {
  it("两项真实冲击只在合法成年继位边界获得原基础十分之一风险", () => {
    const input = context(), draw = vi.fn(() => .5), result = evaluateDynasticRevolution(input, draw);
    expect(result).toMatchObject({ riskTier: "POLITICAL_SHOCK", chance: .014, baseChance: .14, modifierChance: 0, riskMultiplier: .1, rollAttempted: true });
    expect(result.politicalShocks.map(s => s.eventId)).toEqual(["capital", "split"]);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(evaluateDynasticRevolution({ ...input, stability: 45 }, () => .5).chance).toBe(.01);
    expect(evaluateDynasticRevolution(input, () => .014).usurpation).toBe(false);
    expect(evaluateDynasticRevolution(input, () => .013).usurpation).toBe(true);
  });
  it.each(["single", "missing-group", "same-group", "same-city", "same-id", "future", "same-month", "foreign", "foreign-role", "relocation", "ordinary-rebel", "heir-death", "kin-death", "before-reign", "expired", "month-mismatch", "missing-capital-proof", "one-split-city"])("拒绝%s错误证据且不抽签", flaw => {
    let events = [capital(), split()];
    if (flaw === "single") events.pop();
    if (flaw === "missing-group") events[1].historyGroupId = undefined;
    if (flaw === "same-group") events[1].historyGroupId = events[0].historyGroupId;
    if (flaw === "same-city") events[1].metadata!.foundingCityIds = "former-capital,b";
    if (flaw === "same-id") events[1].id = "capital";
    if (flaw === "future" || flaw === "same-month") { events[1].year = flaw === "future" ? 601 : 600; events[1].monthIndex = events[1].year; }
    if (flaw === "foreign") events[1].targetFactionId = "other";
    if (flaw === "foreign-role") events[1].actorFactionId = "state";
    if (flaw === "relocation") events[0].type = "capital-relocated";
    if (flaw === "ordinary-rebel") events[1].type = "rebel-faction-founded";
    if (flaw === "heir-death") events[1].type = "heir-died";
    if (flaw === "kin-death") events[1].type = "ruler-died";
    if (flaw === "before-reign" || flaw === "expired") { events[0].year = flaw === "before-reign" ? 199 : 479; events[0].monthIndex = events[0].year; }
    if (flaw === "month-mismatch") events[0].monthIndex = 501;
    if (flaw === "missing-capital-proof") events[0].metadata = {};
    if (flaw === "one-split-city") { events[1].metadata!.foundingCityIds = "a"; events[1].metadata!.splitCityCount = 1; }
    const draw = vi.fn(() => 0), result = evaluateDynasticRevolution(context(events), draw);
    expect(result.rollAttempted).toBe(false); expect(draw).not.toHaveBeenCalled();
  });
  it.each([{ successor: undefined }, { identityStage: "PROVISIONAL" }, { status: "EXILED" }, { cityCount: 0 }, { cityCount: 3 }, { stability: 46 }])("真实政治硬门不变：%j", change => {
    const draw = vi.fn(() => 0); expect(evaluateDynasticRevolution({ ...context(), ...change }, draw).rollAttempted).toBe(false); expect(draw).not.toHaveBeenCalled();
  });
  it("同月但不同的前置事实可以共存，重复记录不增加风险；旧危机优先且概率不变", () => {
    const events = [capital(), { ...split(), year: 500 }];
    expect(evaluateDynasticRevolution(context(events), () => 1).chance).toBe(.014);
    expect(evaluateDynasticRevolution(context([...events, ...events]), () => 1).chance).toBe(.014);
    const input = context();
    for (const change of [{ previousSuccessionMonths: [560, 580] }, { cityCount: 1, successionReason: "combat" as const },
      { cityCount: 1, successionReason: "captured" as const }, { successor: { ...input.successor!, bornYear: 500 } }]) {
      expect(evaluateDynasticRevolution({ ...input, ...change }, () => 1).chance)
        .toBe(evaluateDynasticRevolution({ ...input, ...change, politicalShocks: [] }, () => 1).chance);
    }
  });
  it("诊断与来源派生只读，不消费随机数，中文摘要区分三个入口", () => {
    const input = context(), raw = JSON.stringify(input), rng = worldRandom.exportState();
    const d = new RevolutionGateDiagnostics(() => true); d.reset(480);
    d.record("state", "旧国", input, evaluateDynasticRevolution(input, () => 1));
    const snapshot = d.snapshot(600);
    expect(snapshot).toMatchObject({ politicalShockEligibleCount: 1, lowerRiskEligibleCount: 0, crisisEligibleCount: 0, rollAttemptCount: 1, expectedUsurpationCount: .014 });
    expect(snapshot.chineseSummary).toContain("新增完整合格危机：1次");
    expect(snapshot.chineseSummary).toContain("抽签概率范围：1.4%～1.4%");
    expect(worldRandom.exportState()).toEqual(rng); expect(JSON.stringify(input)).toBe(raw);
  });
});
