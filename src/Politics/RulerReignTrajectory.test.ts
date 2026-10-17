import { afterEach, describe, expect, it } from "vitest";
import type { Ruler } from "./Dynasty";
import type Team from "../Components/Team";
import WorldHistory, { WorldHistoryStore } from "../History/WorldHistory";
import worldRandom from "../Simulation/WorldRandom";
import { createRulerChronicle, finishRulerChronicle } from "./RulerChronicle";
import { deriveRulerHistoricalEvidence, deriveRulerAssessment, composeHistorianVoice } from "./RulerHistoriography";
import { buildRulerLegacyEvidence } from "./RulerLegacyEvidence";
import { evaluatePosthumousNames, finalizeRulerPosthumousNames } from "./PosthumousRules";
import { formatReignTerritoryChange, getReignTrajectoryPresentation, getSignificantReignStats } from "../UI/Components/FactionDetails/RoyalPresentation";

const team = { name: "state", displayName: "元", identityStage: "STATE", stateFoundedMonth: 0,
  sovereigntyRank: "KING", sovereigntyHistory: [{ rank: "KING", startMonth: 0 }], nameHistory: [{ name: "元", startMonth: 0, reason: "state" }] } as Team;
function ruler(start = 188 * 12 + 3, end = 223 * 12 + 8): Ruler {
  const chronicle = createRulerChronicle({ month: start, population: 1, territoryShare: .0694, cityCount: 1, stability: 46 });
  finishRulerChronicle(chronicle, { month: end, population: 1, territoryShare: .0686, cityCount: 2, stability: 92 });
  chronicle.peakTerritoryShare = .408; chronicle.peakPopulation = 28; chronicle.citiesLostDuringReign = 5;
  return { id: "r", houseName: "江氏", givenName: "玄", bornYear: start - 30 * 12,
    accessionYear: start, endYear: end, reignOrdinal: 3, status: "dead", endReason: "去世", deathMonth: end, deathReason: "去世", chronicle };
}
function context(r: Ruler, history: WorldHistoryStore) {
  return { ruler: r, faction: team, dynasty: { rulers: [r] }, events: history.getEvents(), worldMonth: r.endYear! };
}
function peaceful() {
  const r = ruler(0, 30 * 12), c = r.chronicle!;
  c.accessionSnapshot = { month: 0, population: 40, territoryShare: .2, cityCount: 4, stability: 78 };
  finishRulerChronicle(c, { month: 360, population: 42, territoryShare: .2, cityCount: 4, stability: 85 });
  c.peakTerritoryShare = .21; c.peakPopulation = 43; c.citiesLostDuringReign = 0;
  return r;
}
afterEach(() => WorldHistory.reset());

describe("shared reign trajectory for evidence, titles and visible text", () => {
  it("reproduces the peak .408 → .0686 case without treating stable endpoints as peaceful stewardship", () => {
    const r = ruler(), history = new WorldHistoryStore();
    for (let i = 0; i < 3; i++) history.addCityCaptured(r.accessionYear! + i + 1, team.name, "enemy", "enemy", `city${i}`, `c${i}`, false);
    for (let i = 0; i < 6; i++) history.addEvent({ id: `sign${i}`, year: r.accessionYear! + 20 + i,
      type: "truce-signed", category: "politics", title: "停战", importance: "major", factionIds: [team.name, "enemy"],
      metadata: { signatoryARulerId: r.id, signatoryAFactionId: team.name } });
    const evidence = deriveRulerHistoricalEvidence(context(r, history));
    expect(evidence.trajectory).toMatchObject({ peakTerritory: .408, peakPopulation: 28, citiesLost: 5, activeRuleMonths: 425,
      expandedThenRetreated: true, quietStewardshipEligible: false, stableTrajectoryEligible: false, nationalCityCaptures: 3 });
    expect(evidence.trajectory.peakToEndRetreat).toBeCloseTo(.3394);
    expect(evidence.stableGovernanceEligible).toBe(false); expect(evidence.roles).not.toContain("STEWARD");
    const title = evaluatePosthumousNames(r, [r], team, r.endYear!, history.getEvents());
    expect(title.epithetReasons.join("")).not.toMatch(/长期守成|政局和顺|治理稳定|国势变化有限/);
    expect(title.posthumousEpithet).not.toBe("顺"); expect(title.templeName).toBeUndefined();
    const assessment = deriveRulerAssessment(context(r, history));
    expect(assessment.lines.join("")).toContain("40.8%"); expect(assessment.lines.join("")).toContain("失城记录5次");
    expect(assessment.lines.join("")).not.toMatch(/守成为其主要遗产|少有显著拓境|亲征夺城/);
    expect(getSignificantReignStats(r.chronicle!, evidence.politicalFacts)).toContain("治下攻陷普通城市：3");
    expect(getSignificantReignStats(r.chronicle!, evidence.politicalFacts)).toContain("本人签署外交协议：6");
    expect(composeHistorianVoice(evidence)).toMatch(/回落|未能守成/);
    const display = getReignTrajectoryPresentation(evidence.trajectory);
    expect(display).toContain("记录峰值40.8%"); expect(display).toContain("扩张后显著回撤"); expect(display).not.toMatch(/年|月/);
    expect(display.match(/峰值/g)).toHaveLength(1);
  });
  it("preserves normal long peaceful stewardship and its eligible epithet", () => {
    const r = peaceful(), e = deriveRulerHistoricalEvidence(context(r, new WorldHistoryStore()));
    expect(e.trajectory.quietStewardshipEligible).toBe(true); expect(e.roles).toContain("STEWARD");
    expect(evaluatePosthumousNames(r, [r], team, r.endYear!, []).posthumousEpithet).toBe("顺");
  });
  it("distinguishes expansion mostly retained from a return towards the starting position", () => {
    const r = peaceful(), c = r.chronicle!;
    c.peakTerritoryShare = .4; c.endSnapshot!.territoryShare = .37; c.endSnapshot!.cityCount = 7;
    const e = deriveRulerHistoricalEvidence(context(r, new WorldHistoryStore()));
    expect(e.trajectory).toMatchObject({ expandedAndRetained: true, expandedThenRetreated: false, majorTerritoryRetreat: false, quietStewardshipEligible: false });
    expect(getReignTrajectoryPresentation(e.trajectory)).toContain("成果大部保有");
  });
  it("distinguishes inherited high territory from newly created expansion", () => {
    const r = peaceful(), c = r.chronicle!;
    c.accessionSnapshot.territoryShare = .4; c.peakTerritoryShare = .41; c.endSnapshot!.territoryShare = .15;
    const e = deriveRulerHistoricalEvidence(context(r, new WorldHistoryStore()));
    expect(e.trajectory).toMatchObject({ inheritedDecline: true, expandedThenRetreated: false });
    expect(deriveRulerAssessment(context(r, new WorldHistoryStore())).lines.join("")).toContain("承统时国势已居高位");
    expect(e.stableGovernanceEligible).toBe(false);
  });
  it("separates regained cities after repeated losses from an undisturbed reign", () => {
    const r = peaceful(); r.chronicle!.citiesLostDuringReign = 5;
    const e = deriveRulerHistoricalEvidence(context(r, new WorldHistoryStore()));
    expect(e.trajectory).toMatchObject({ recoveredAfterWarfare: true, quietStewardshipEligible: false });
    expect(e.stableGovernanceEligible).toBe(false); expect(composeHistorianVoice(e)).toContain("战乱后的恢复");
  });
  it("does not let a population boom followed by collapse masquerade as unchanged population", () => {
    const r = peaceful(); r.chronicle!.peakPopulation = 150;
    const e = buildRulerLegacyEvidence(r.chronicle!, 0, 360);
    expect(e.trajectory.majorPopulationRetreat).toBe(true); expect(e.steadyRule).toBe(false); expect(e.longStableReign).toBe(false);
  });
  it("treats deduplicated capital crises as disruption, without adding personal military credit", () => {
    const r = peaceful(), history = new WorldHistoryStore();
    history.addCapitalFallen(10, "enemy", team.name, team.name, "都", "c", true, 10, undefined, undefined, "fall");
    history.addCityCaptured(10, "enemy", team.name, team.name, "都", "c", true, true, 10, undefined, undefined, "fall");
    history.addCapitalRelocated(10, team.name, "新都", "new", "fall", { cause: "CAPITAL_FALL" });
    const e = deriveRulerHistoricalEvidence(context(r, history));
    expect(e.trajectory.capitalLosses).toBe(1); expect(e.trajectory.stableTrajectoryEligible).toBe(false);
    expect(e.politicalFacts.filter(f => f.militaryRole === "DEFENDER" && f.wasCapital)).toHaveLength(1);
    expect(getSignificantReignStats(r.chronicle!, e.politicalFacts)).toContain("国难过程（按历史组）：1");
    expect(evaluatePosthumousNames(r, [r], team, 360, history.getEvents()).epithetReasons.join("")).not.toContain("政局和顺");
  });
  it("uses the new evidence for actual finalization while leaving frozen titles intact", () => {
    const fresh = ruler(); finalizeRulerPosthumousNames(fresh, [fresh], team, fresh.endYear!);
    expect(fresh.posthumousEpithetReasons?.join("")).not.toMatch(/政局和顺|国势变化有限/);
    const frozen = ruler(); frozen.posthumousEpithet = "顺"; frozen.posthumousEpithetReasons = ["长期守成，政局和顺"];
    const before = JSON.stringify(frozen); finalizeRulerPosthumousNames(frozen, [frozen], team, frozen.endYear!);
    expect(JSON.stringify(frozen)).toBe(before);
  });
  it("renders fractional changes in percentage points without hiding the real difference", () => {
    expect(formatReignTerritoryChange(.0694, .0686)).toBe("6.94% → 6.86%（−0.08个百分点）");
    expect(formatReignTerritoryChange(.2, .2)).toContain("持平");
    expect(formatReignTerritoryChange(.2, .2 - 1e-12)).toContain("实际微降");
  });
});

describe("exile loss attribution and life boundaries", () => {
  function terminal(start: number, end: number) {
    const r = ruler(start, end); r.status = "politically-ended"; r.endReason = "政治终结";
    delete r.deathMonth; delete r.deathReason;
    r.chronicle!.peakPopulation = 1; r.chronicle!.peakTerritoryShare = .07;
    r.chronicle!.endSnapshot!.cityCount = 0;
    return r;
  }
  it("records loss during the reign and later political extinction without inventing death or fault", () => {
    const start = 145 * 12, end = 183 * 12 + 6, r = terminal(start, end), history = new WorldHistoryStore();
    history.addCapitalFallen(158 * 12 + 8, "enemy", team.name, team.name, "邯郸", "a", true, 10, undefined, undefined, "loss-a");
    history.addCapitalRelocated(158 * 12 + 8, team.name, "大梁", "b", "loss-a", { cause: "CAPITAL_FALL" });
    history.addCapitalFallen(161 * 12 + 4, "enemy", team.name, team.name, "大梁", "b", true, 10, undefined, undefined, "loss-b");
    history.addCapitalRelocated(161 * 12 + 4, team.name, "末城", "c", "loss-b", { cause: "CAPITAL_FALL" });
    history.addFactionExiled(162 * 12 + 6, team.name, "侯康", 1);
    history.addFactionExtinct(end, team.name);
    const input = context(r, history), e = deriveRulerHistoricalEvidence(input);
    expect(e.tenure).toMatchObject({ activeRuleMonths: 210, exileMonths: 252, lostStateDuringTenure: true, exiledAtAccession: false });
    const text = deriveRulerAssessment(input).lines.join("") + composeHistorianVoice(e);
    expect(text).toContain("失国与政治终结均发生于其承统期间");
    expect(text).not.toMatch(/并不意味着失国始于此人|不等于失国始于其任内|享年|去世|昏庸|失德/);
    expect(e.forcedCapitalRelocationsDuringReign).toBe(2);
  });
  it("recognizes an exile inherited before accession without assigning earlier losses to the successor", () => {
    const r = terminal(120, 234), history = new WorldHistoryStore();
    history.addFactionExiled(100, team.name, "前君", 1); history.addFactionExtinct(234, team.name);
    const e = deriveRulerHistoricalEvidence(context(r, history));
    expect(e.tenure).toMatchObject({ activeRuleMonths: 0, exileMonths: 114, lostStateDuringTenure: false, exiledAtAccession: true });
    expect(composeHistorianVoice(e)).toContain("失国早于其继位");
    expect(deriveRulerAssessment(context(r, history)).lines.join("")).not.toMatch(/享年|去世/);
  });
  it("retains actual restoration and repeated loss instead of describing a permanently landless reign", () => {
    const r = terminal(0, 360), history = new WorldHistoryStore();
    history.addFactionExiled(20, team.name, "君主", 1);
    history.addFactionRestored(30, team.name, "城", 1, "c", "restore", { basis: "FORMER_CAPITAL", heldMonths: 120, rulerId: "r" });
    history.addFactionExiled(100, team.name, "君主", 1); history.addFactionExtinct(360, team.name);
    const result = deriveRulerAssessment(context(r, history));
    expect(result.evidence.tenure).toMatchObject({ stateLossCount: 2, restorationCount: 1, activeRuleMonths: 90 });
    expect(result.lines.join("")).toContain("实际复国1次"); expect(result.lines.join("")).not.toContain("全部承统岁月均在流亡");
  });
  it("does not append the legacy restoration sentence after the inherited-exile tenure summary", () => {
    const r = terminal(120, 250), history = new WorldHistoryStore();
    history.addFactionExiled(100, team.name, "前君", 1);
    history.addFactionRestored(135, team.name, "城", 1, "c", "restore", { basis: "FORMER_CAPITAL", heldMonths: 120, rulerId: "r" });
    const result = deriveRulerAssessment(context(r, history));
    expect(result.evidence.tenure).toMatchObject({ exiledAtAccession: true, restoredDuringTenure: true });
    expect(result.lines[0]).toContain("承统之际已失城土");
    expect(result.lines.filter(line => /复国|恢复国家/.test(line))).toHaveLength(1);
    expect(result.lines.join("")).not.toContain("最重要的历史转折");
  });
  it("generates the same evidence without consuming RNG or modifying canonical facts", () => {
    const r = ruler(), history = new WorldHistoryStore(), input = context(r, history);
    worldRandom.initialize("trajectory-audit"); const random = worldRandom.exportState(), before = JSON.stringify(input);
    const first = deriveRulerAssessment(input), voice = composeHistorianVoice(first.evidence);
    expect(deriveRulerAssessment(input)).toEqual(first); expect(composeHistorianVoice(first.evidence)).toBe(voice);
    expect(worldRandom.exportState()).toEqual(random); expect(JSON.stringify(input)).toBe(before);
  });
});
