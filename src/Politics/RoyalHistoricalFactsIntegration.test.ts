import { describe, expect, it } from "vitest";
import type { Ruler } from "./Dynasty";
import type Team from "../Components/Team";
import { WorldHistoryStore } from "../History/WorldHistory";
import { createRulerChronicle, finishRulerChronicle, getRulerHistoricalEvents, observeRulerPeak } from "./RulerChronicle";
import { deriveRulerAssessment, composeHistorianVoice } from "./RulerHistoriography";
import { evaluatePosthumousNames, finalizeRulerPosthumousNames } from "./PosthumousRules";
import { getSignificantReignStats } from "../UI/Components/FactionDetails/RoyalPresentation";
import { summarizeRulerPoliticalFacts } from "./RulerPoliticalFacts";

function person(start = 275, end = 814, cities = 0): Ruler {
  const chronicle = createRulerChronicle({ month: start, population: 0, territoryShare: 0, cityCount: cities, stability: 60 });
  finishRulerChronicle(chronicle, { month: end, population: 0, territoryShare: 0, cityCount: 0, stability: 60 });
  return { id: "r", houseName: "熊氏", givenName: "谦", bornYear: Math.min(30, start - 20 * 12), accessionYear: start, endYear: end,
    deathMonth: end, deathReason: "去世", endReason: "去世", status: "dead", reignOrdinal: 2, chronicle };
}
const faction = { name: "楚", displayName: "楚", identityStage: "STATE", stateFoundedMonth: 0,
  sovereigntyRank: "KING", sovereigntyHistory: [{ rank: "KING", startMonth: 0 }], nameHistory: [{ name: "楚", startMonth: 0, reason: "state" }] } as Team;
function assessment(ruler: Ruler, history: WorldHistoryStore) {
  return deriveRulerAssessment({ ruler, dynasty: { rulers: [ruler] }, faction, events: history.getEvents(), worldMonth: ruler.endYear ?? 814 });
}
function restoredHistory() {
  const history = new WorldHistoryStore();
  history.addFactionExiled(275, "楚", "熊谦", 1);
  history.addFactionRestored(336, "楚", "故都", 1, "city", "restore-1", { basis: "FORMER_CAPITAL", heldMonths: 200, rulerId: "r" });
  history.addFactionExiled(343, "楚", "熊谦", 1);
  history.addFactionRestored(372, "楚", "故都", 1, "city", "restore-2", { basis: "FORMER_CAPITAL", heldMonths: 200, rulerId: "r" });
  history.addFactionExiled(593, "楚", "熊谦", 1);
  for (const month of [350, 400]) history.addEvent({ id: `treaty-${month}`, year: month, category: "politics", type: "truce-signed", title: "停战", importance: "major",
    factionIds: ["楚", "齐"], metadata: { signatoryARulerId: "r", signatoryAFactionId: "楚" } });
  return history;
}

describe("canonical history → ruler evidence → titles, assessment and presentation", () => {
  it("retains two restorations and nineteen active years despite zero endpoint cities", () => {
    const ruler = person(), history = restoredHistory(), before = JSON.stringify(history.getEvents());
    observeRulerPeak(ruler.chronicle!, { month: 400, population: 12, territoryShare: 0.12, cityCount: 2, stability: 70 });
    const result = assessment(ruler, history), e = result.evidence;
    expect(e.tenure).toMatchObject({ totalTenureMonths: 539, activeRuleMonths: 228, exileMonths: 311, restorationCount: 2, restoredActiveRuleMonths: 228, stateLossCount: 3, diedInExile: true });
    expect(e).toMatchObject({ startCityCount: 0, endCityCount: 0, observedPeakCityCount: 2, restorationCount: 2, terminalCollapse: false });
    const text = result.lines.join("");
    expect(text).toContain("实际复国2次"); expect(text).toContain("在国治理19年"); expect(text).toContain("本人外交签署记录共2项");
    expect(text).toContain("流亡期间于67年11月去世");
    expect(text).not.toMatch(/仅据孤城|因去世|始终流亡|未能复国|从未恢复/);
    expect(composeHistorianVoice(e)).toContain("屡复故国"); expect(composeHistorianVoice(e)).not.toBe(text);
    const stats = getSignificantReignStats(ruler.chronicle!, e.politicalFacts);
    expect(stats).toContain("复国：2"); expect(stats).toContain("失国：3"); expect(stats).toContain("本人签署外交协议：2");
    const names = evaluatePosthumousNames(ruler, [ruler], faction, 814, history.getEvents());
    expect(names.posthumousEpithet).toBe("宣"); expect(names.epithetReasons.join("")).toContain("实际在国治理"); expect(names.templeName).toBeDefined();
    expect(JSON.stringify(history.getEvents())).toBe(before);
  });
  it.each([0, 1, 3])("does not confuse %s accession cities with a lone city", cities => {
    const ruler = person(0, 24, cities); ruler.endReason = "政治终结"; ruler.status = "politically-ended"; delete ruler.deathMonth; delete ruler.deathReason;
    const text = assessment(ruler, new WorldHistoryStore()).lines.join("");
    expect(text.includes("仅据孤城")).toBe(cities === 1);
    expect(text).not.toMatch(/享年|去世/);
  });
  it.each(["战死", "被俘处死"] as const)("uses the recorded death %s, never the political exit reason", reason => {
    const ruler = person(); ruler.deathReason = reason; ruler.endReason = "被废";
    const text = assessment(ruler, new WorldHistoryStore()).lines.join("");
    expect(text).toContain(`67年11月${reason}`); expect(text).not.toContain("因被废");
  });
  it("separates a brief recovery, durable restoration, never-restored exile and actual extinction", () => {
    const history = new WorldHistoryStore(), ruler = person(0, 120);
    history.addFactionExiled(0, "楚", "熊谦", 1);
    history.addFactionRestored(24, "楚", "故都", 1, "c", undefined, { basis: "FORMER_CAPITAL", heldMonths: 120, rulerId: "r" });
    history.addFactionExiled(27, "楚", "熊谦", 1);
    const brief = evaluatePosthumousNames(ruler, [ruler], faction, 120, history.getEvents());
    expect(brief.templeName).toBeUndefined(); expect(brief.epithetReasons.join("")).toContain("未满十年");
    const never = new WorldHistoryStore(); never.addFactionExiled(0, "楚", "熊谦", 1);
    expect(assessment(ruler, never).evidence.tenure.activeRuleMonths).toBe(0);
    expect(evaluatePosthumousNames(ruler, [ruler], faction, 120, never.getEvents()).posthumousEpithet).toBeUndefined();
    never.addFactionExtinct(120, "楚");
    expect(assessment(ruler, never).evidence.terminalCollapse).toBe(true);
    expect(evaluatePosthumousNames(ruler, [ruler], faction, 120, never.getEvents()).posthumousEpithet).toBe("愍");
  });
  it("does not use decades before loss to inflate a three-month restoration", () => {
    const history = new WorldHistoryStore(), ruler = person(0, 500, 3);
    history.addFactionExiled(400, "楚", "熊谦", 1);
    history.addFactionRestored(450, "楚", "故都", 1, "c", undefined, { basis: "FORMER_CAPITAL", heldMonths: 400, rulerId: "r" });
    history.addFactionExiled(453, "楚", "熊谦", 1);
    const result = assessment(ruler, history);
    expect(result.evidence.tenure).toMatchObject({ activeRuleMonths: 403, restoredActiveRuleMonths: 3 });
    expect(evaluatePosthumousNames(ruler, [ruler], faction, 500, history.getEvents()).epithetReasons.join("")).not.toContain("至少十年");
    expect(composeHistorianVoice(result.evidence)).toContain("恢复尚未稳固");
  });
  it.each([false, true])("distinguishes national captures from direct actions (%s) and groups duplicate city results", direct => {
    const history = new WorldHistoryStore(), ruler = person(0, 120, 3), actor = direct ? "r" : undefined;
    history.addCityCaptured(40, "楚", "齐", "齐", "齐都", "c", true, true, 10, undefined, actor, "campaign");
    history.addCapitalFallen(40, "楚", "齐", "齐", "齐都", "c", true, 10, undefined, actor, "campaign");
    history.addFactionExiled(40, "齐", "齐王", 1, { conquerorFactionId: "楚" }, "campaign");
    history.addFactionExtinct(40, "齐", undefined, { conquerorFactionId: "楚" }, "campaign");
    history.addCityCaptured(45, "楚", "燕", "燕", "古都", "old", false, true, 10, undefined, undefined, "second");
    const result = assessment(ruler, history), stats = summarizeRulerPoliticalFacts(result.evidence.politicalFacts);
    expect(stats).toMatchObject({ nationalCityCaptures: 1, nationalCapitalCaptures: 1, personalCityCaptures: direct ? 1 : 0,
      personalCapitalCaptures: direct ? 1 : 0, nationalExtinctions: 1, personalExtinctions: direct ? 1 : 0 });
    expect(getSignificantReignStats(ruler.chronicle!, result.evidence.politicalFacts)).toContain("治下攻陷当时敌都：1");
    if (!direct) expect(result.lines.join("")).not.toContain("亲征攻陷");
    const future = history.addCityCaptured(121, "楚", "齐", "齐", "未来", "future", true);
    expect(assessment(ruler, history).evidence.politicalFacts.some(f => f.eventId === future)).toBe(false);
  });
  it("counts one national crisis process and separate facts without blaming the ruler", () => {
    const history = new WorldHistoryStore(), ruler = person(0, 120, 3);
    history.addCapitalFallen(40, "齐", "楚", "楚", "故都", "c", true, 10, undefined, undefined, "fall");
    history.addCapitalRelocated(40, "楚", "新都", "new", "fall", { cause: "CAPITAL_FALL" });
    history.addFactionExiled(40, "楚", "熊谦", 1, {}, "fall");
    // A second state's loss is never this ruler's domestic crisis.
    history.addCapitalFallen(50, "齐", "燕", "燕", "燕都", "foreign", true, 10, undefined, undefined, "foreign");
    const e = assessment(ruler, history).evidence;
    expect(summarizeRulerPoliticalFacts(e.politicalFacts)).toMatchObject({ crisisEpisodes: 1, stateLosses: 1, capitalLosses: 1 });
    expect(e.politicalFacts.find(f => f.type === "capital-fallen")?.outcome).toBe("本国失去都城");
    expect(assessment(ruler, history).lines.join("")).not.toMatch(/失德|昏庸|暴虐/);
  });
  it("deduplicates actual signatures but never promotes renewals to diplomatic achievement", () => {
    const history = new WorldHistoryStore(), ruler = person(0, 120, 3);
    const signature = { id: "sign", year: 40, type: "alliance-signed" as const, category: "politics" as const, title: "结盟", importance: "major" as const,
      historyGroupId: "treaty", factionIds: ["楚", "齐"], metadata: { signatoryARulerId: "r", signatoryAFactionId: "楚" } };
    history.addEvent(signature); history.addEvent({ ...signature, id: "duplicate" });
    history.addEvent({ ...signature, id: "renew", year: 50, type: "relation-renewed", historyGroupId: "renew" });
    history.addEvent({ ...signature, id: "unsigned", year: 60, historyGroupId: "unsigned", metadata: {} });
    const result = assessment(ruler, history);
    expect(summarizeRulerPoliticalFacts(result.evidence.politicalFacts)).toMatchObject({ personalSignatures: 1, renewals: 1, nationalDiplomacy: 1 });
    expect(result.lines.join("")).not.toMatch(/外交卓越|结盟致胜|同盟取胜/);
  });
  it("does not silently regrant frozen V15 names or reasons", () => {
    const ruler = person(); ruler.posthumousEpithet = "愍"; ruler.posthumousEpithetReasons = ["原V15理由"];
    ruler.templeName = "中宗"; ruler.templeNameReasons = ["既有庙号"];
    const before = JSON.stringify(ruler); finalizeRulerPosthumousNames(ruler, [ruler], faction, 814);
    expect(JSON.stringify(ruler)).toBe(before);
  });
  it("keeps the canonical usurper, predecessor and excluded successor distinct in biographies", () => {
    const history = new WorldHistoryStore(), ruler = person(40, 120);
    const id = history.addDynasticRevolution(40, "楚", "r", { month: 40, newRulerName: "熊谦", predecessorRulerId: "old", previousRulerTitle: "旧王", successionReason: "combat",
      oldHouseName: "甲氏", newHouseName: "熊氏", displacedSuccessorId: "heir", displacedSuccessorName: "甲安", oldStateName: "旧国", newStateName: "楚" });
    const biography = getRulerHistoricalEvents(history.getEvents(), { ...ruler, accessionYear: ruler.accessionYear! }, "楚", 120, [], 100);
    expect(biography.map(e => e.id)).toContain(id);
    expect(biography.find(e => e.id === id)?.description).toBe(history.getEvents()[0].description);
    expect(assessment(ruler, history).evidence.politicalFacts[0]).toMatchObject({ usurpationRole: "USURPER", rulerId: "r", oldHouseName: "甲氏", newHouseName: "熊氏" });
  });
});
