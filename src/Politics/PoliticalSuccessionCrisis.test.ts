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
  actorFactionId: "rebel", targetFactionId: "state", historyGroupId: "split-group", metadata: { parentFactionId: "state", foundingCityIds: "a,b", foundingCityNames: "甲、乙", splitCityCount: 2 } });
const context = (events = [capital(), split()]): RevolutionContext => ({ worldMonth: 600, factionId: "state", predecessor,
  successor: { id: "heir", houseName: "田氏", givenName: "安", bornYear: 250, status: "heir" }, previousSuccessionMonths: [],
  successionReason: "natural", identityStage: "STATE", status: "ACTIVE", stability: 50, cityCount: 4,
  politicalShocks: derivePoliticalSuccessionShocks("state", predecessor, 600, events) });

describe("政治重创继位资格与真实历史证据", () => {
  it("单项失都证据加现实脆弱性即可进入2%低风险候选", () => {
    const input = { ...context([capital()]), cityCount: 2, stability: 50 }, draw = vi.fn(() => .5);
    const result = evaluateDynasticRevolution(input, draw);
    expect(result).toMatchObject({ riskTier: "POLITICAL_SHOCK", chance: .03, baseChance: .02, modifierChance: .01, rollAttempted: true });
    expect(result.politicalShocks.map(s => s.eventId)).toEqual(["capital"]);
    expect(draw).toHaveBeenCalledTimes(1);
  });
  it("单项重大分裂证据加低稳定度即可进入候选；同事件绝不重复加权", () => {
    const onlySplit = context([split()]);
    const result = evaluateDynasticRevolution({ ...onlySplit, stability: 40, cityCount: 4 }, () => .5);
    expect(result).toMatchObject({ riskTier: "POLITICAL_SHOCK", chance: .03, rollAttempted: true });
    const duplicate = context([split(), { ...split(), id: "split-copy" }]);
    expect(evaluateDynasticRevolution({ ...duplicate, stability: 40, cityCount: 4 }, () => .5).politicalShocks).toHaveLength(1);
    expect(evaluateDynasticRevolution({ ...duplicate, stability: 40, cityCount: 4 }, () => .5).chance).toBe(.03);
  });
  it("同一历史事件组中的失都和分裂只贡献一个严重冲击", () => {
    const events = [capital(), split()]; events[1].historyGroupId = "battle";
    const result = evaluateDynasticRevolution({ ...context(events), cityCount: 2, stability: 50 }, () => .99);
    expect(result.politicalShocks).toHaveLength(1);
    expect(result.chance).toBe(.03);
  });
  it("区分2%至6%分层风险，单次概率不替代资格次数", () => {
    const input = context();
    const mild = evaluateDynasticRevolution({ ...input, cityCount: 4, stability: 55 }, () => .99);
    const strong = evaluateDynasticRevolution({ ...input, cityCount: 2, stability: 40, successionReason: "combat" }, () => .99);
    expect(mild.chance).toBe(.03);
    expect(strong.chance).toBe(.06);
    expect(mild.rollAttempted).toBe(true); expect(strong.rollAttempted).toBe(true);
  });
  it.each(["missing-group", "foreign", "foreign-role", "relocation", "ordinary-rebel", "heir-death", "kin-death", "before-reign", "expired", "month-mismatch", "missing-capital-proof", "one-split-city", "future", "same-month"])("拒绝%s的无效历史身份或时间证据", flaw => {
    const event = flaw.includes("split") || flaw === "foreign" || flaw === "foreign-role" || flaw === "ordinary-rebel" || flaw === "heir-death" || flaw === "kin-death" ? split() : capital();
    if (flaw === "missing-group") event.historyGroupId = undefined;
    if (flaw === "foreign") event.targetFactionId = "other";
    if (flaw === "foreign-role") event.actorFactionId = "state";
    if (flaw === "relocation") event.type = "capital-relocated";
    if (flaw === "ordinary-rebel") event.type = "rebel-faction-founded";
    if (flaw === "heir-death") event.type = "heir-died";
    if (flaw === "kin-death") event.type = "ruler-died";
    if (flaw === "before-reign" || flaw === "expired" || flaw === "future" || flaw === "same-month") { event.year = flaw === "before-reign" ? 199 : flaw === "expired" ? 479 : flaw === "future" ? 601 : 600; event.monthIndex = event.year; }
    if (flaw === "month-mismatch") event.monthIndex = 501;
    if (flaw === "missing-capital-proof") event.metadata = {};
    if (flaw === "one-split-city") event.metadata = { parentFactionId: "state", foundingCityIds: "a", splitCityCount: 1 };
    expect(derivePoliticalSuccessionShocks("state", predecessor, 600, [event])).toEqual([]);
  });
  it.each([{ stability: 61 }, { cityCount: 5 }, { cityCount: 8, stability: 80 }, { cityCount: 5, stability: 80 }])("现实脆弱性不足时不因重大冲击单独抽签：%j", change => {
    const draw = vi.fn(() => 0), input = { ...context([capital()]), ...change };
    expect(evaluateDynasticRevolution(input, draw).rollAttempted).toBe(false); expect(draw).not.toHaveBeenCalled();
  });
  it("无历史冲击时低稳定本身不能开启新入口", () => {
    const draw = vi.fn(() => 0), input = { ...context([]), stability: 20, cityCount: 2 };
    expect(evaluateDynasticRevolution(input, draw).rollAttempted).toBe(false); expect(draw).not.toHaveBeenCalled();
  });
  it("前君战死/被俘可以独立作为真实严重冲击，但必须仍有脆弱性", () => {
    const base = context([]);
    expect(evaluateDynasticRevolution({ ...base, successionReason: "combat", cityCount: 2, stability: 50 }, () => .99).chance).toBe(.03);
    const draw = vi.fn(() => 0);
    expect(evaluateDynasticRevolution({ ...base, successionReason: "captured", cityCount: 6, stability: 80 }, draw).rollAttempted).toBe(false);
    expect(draw).not.toHaveBeenCalled();
  });
  it("和平成年稳定继位、无合法继承人、临时/流亡国家仍不新增风险", () => {
    const input = { ...context([capital(), split()]), cityCount: 8, stability: 80 };
    for (const change of [{ politicalShocks: [] }, { successor: undefined }, { identityStage: "PROVISIONAL" }, { status: "EXILED" }, { cityCount: 0 }]) {
      const draw = vi.fn(() => 0);
      expect(evaluateDynasticRevolution({ ...input, ...change }, draw).rollAttempted).toBe(false);
      expect(draw).not.toHaveBeenCalled();
    }
  });
  it("旧最高级与战死/被俘孤城入口优先，公式不受新证据改变", () => {
    const input = context(), noHistory = { ...input, politicalShocks: [] };
    for (const change of [{ previousSuccessionMonths: [560, 580] }, { cityCount: 1, successionReason: "combat" as const },
      { cityCount: 1, successionReason: "captured" as const }]) {
      expect(evaluateDynasticRevolution({ ...input, ...change }, () => 1).chance)
        .toBe(evaluateDynasticRevolution({ ...noHistory, ...change }, () => 1).chance);
    }
  });
  it("只读诊断记录两类冲击、暴力结局、脆弱性和新合格次数，不消费RNG", () => {
    const input = { ...context(), cityCount: 2, stability: 40 }, raw = JSON.stringify(input), rng = worldRandom.exportState();
    const diagnostics = new RevolutionGateDiagnostics(() => true); diagnostics.reset(480);
    diagnostics.record("state", "旧国", input, evaluateDynasticRevolution(input, () => .99));
    const snapshot = diagnostics.snapshot(600);
    expect(snapshot).toMatchObject({ capitalLossEvidenceBoundaryCount: 1, empireSplitEvidenceBoundaryCount: 1,
      politicalVulnerabilityBoundaryCount: 1, politicalShockEligibleCount: 1, rollAttemptCount: 1, expectedUsurpationCount: .05 });
    expect(snapshot.chineseSummary).toContain("有失都证据的继位：1次");
    expect(snapshot.chineseSummary).toContain("新政治重创合格：1次");
    expect(worldRandom.exportState()).toEqual(rng); expect(JSON.stringify(input)).toBe(raw);
  });
});
