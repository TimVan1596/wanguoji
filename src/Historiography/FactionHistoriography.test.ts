import { describe, expect, it } from "vitest";
import { deriveFactionAssessment, deriveFactionHistoricalEvidence, classifyFactionHistoricalProfile, type FactionHistoryContext } from "./FactionHistoriography";
import type { Ruler } from "../Politics/Dynasty";
import worldRandom from "../Simulation/WorldRandom";

function context(ending: "EXTINCT" | "MERGED" | "SUBMITTED" = "EXTINCT"): FactionHistoryContext {
  const faction = { name: "a", displayName: "张", status: "EXTINCT", identityStage: "STATE", firstFoundedYear: 0,
    origin: { foundedMonth: 0 }, stateFoundedMonth: 60, extinctionYear: 3600, terminationMonth: 3600, terminationReason: ending,
    terminationTargetFactionId: ending === "EXTINCT" ? undefined : "b", cumulativeActiveYears: 3480,
    restorationYears: [200], lastExiledYear: 80, sovereigntyHistory: [{ rank: "KING", startMonth: 0 }, { rank: "EMPEROR", startMonth: 1000 }], nameHistory: [{ name: "张", startMonth: 0 }] };
  const target = { ...faction, name: "b", displayName: "秦", nameHistory: [{ name: "鄄", startMonth: 0, endMonth: 3600 }, { name: "秦", startMonth: 3601 }] };
  const ruler = (id: string, accessionYear: number, endYear?: number): Ruler => ({ id, bornYear: 0, houseName: "陈氏", givenName: id, accessionYear, endYear, status: ending === "EXTINCT" ? "dead" : "abdicated" });
  return { faction, factions: new Map([["a", faction], ["b", target]]), totalWorldBlocks: 1000,
    lifetime: { factionId: "a", lastObservedMonth: 3600, peakPopulation: { value: 100, month: 100, source: "MONTHLY" },
      peakTerritoryBlocks: { value: 318, month: 200, source: "MONTHLY" }, peakCityCount: { value: 8, month: 300, source: "MONTHLY" },
      terminal: { month: 3600, population: 5, territoryBlocks: 10, cityCount: 1 } },
    dynasty: { rulers: [ruler("early", 0, 50), ruler("founder", 50, 1200), ruler("last", 1200, 3600),
      { id: "heir", houseName: "陈氏", givenName: "继", bornYear: 3590, status: "kin" }],
      houseEpochs: [{ houseName: "陈氏", startMonth: 0, foundingRulerId: "early", startReason: "FOUNDING", endMonth: 1199 },
        { houseName: "贺氏", startMonth: 1200, foundingRulerId: "last", startReason: "USURPATION" }] }, events: [] };
}
describe("evidence-based faction historiography", () => {
  it.each(["EXTINCT", "MERGED", "SUBMITTED"] as const)("distinguishes %s and resolves the target at termination", ending => {
    const c = context(ending), a = deriveFactionAssessment(c)!;
    expect(a.title).toBe("国评"); expect(a.evidence.factionId).toBe("a");
    if (ending === "EXTINCT") { expect(a.lines.join(" ")).toContain("彻底终结"); expect(a.lines.join(" ")).not.toMatch(/归附|自愿/); }
    else { expect(a.facts[0]).toContain("鄄"); expect(a.facts[0]).not.toContain("秦"); expect(a.facts[0]).toContain(ending === "MERGED" ? "同源合邦" : "和平纳土"); }
  });
  it("never finalizes active or merely exiled factions", () => {
    for (const status of ["ACTIVE", "EXILED"]) {
      const c = context(); c.faction.status = status; expect(deriveFactionAssessment(c)).toBeUndefined();
    }
  });
  it("keeps separate origins, formal duration, active months, rulers and multiple epochs in one faction", () => {
    const a = deriveFactionAssessment(context())!;
    expect(a.evidence).toMatchObject({ lifetimeMonths: 3600, formalMonths: 3540, activeMonths: 3480, exileMonths: 120, rulerCount: 3, formalRulerCount: 2, epochCount: 2, houseCount: 2, usurpationCount: 1 });
    expect(a.facts.join(" ")).toContain("正式国祚历时：295年");
    expect(a.profiles.find(p => p.key === "MULTI_HOUSE")!.evidenceFields).toContain("houseCount");
    expect(a.profiles.every(p => p.reason && p.evidenceFields.length > 0)).toBe(true);
  });
  it("a provisional extinct faction gets no formal reign and no emperors invented", () => {
    const c = context(); c.faction.identityStage = "PROVISIONAL"; c.faction.stateFoundedMonth = undefined as any;
    c.faction.sovereigntyHistory = [{ rank: "LEADER", startMonth: 0 }];
    const a = deriveFactionAssessment(c)!;
    expect(a.title).toBe("势力结语"); expect(a.summary).toContain("位首领");
    expect(a.facts.join(" ")).toContain("势力结局：");
    expect(a.facts.join(" ")).not.toMatch(/国家结局|正式国祚|历\d+帝/); expect(a.evidence.formalRulerCount).toBe(0);
  });
  it("keeps peak months and percentage bases independent", () => {
    const a = deriveFactionAssessment(context())!;
    expect(a.facts).toContain("最高人口：100人（8年5月）");
    expect(a.facts).toContain("最大疆域：318格，占世界31.8%（16年9月）");
    expect(a.facts).toContain("最多城市：8座（25年1月）");
    expect(a.evidence.peakAbsoluteWorldShare).toBe(0.318);
  });
  it("does not invent a conqueror or turn abdication into death", () => {
    const c = context("SUBMITTED"), original = JSON.stringify(c.dynasty);
    const a = deriveFactionAssessment(c)!; expect(a.facts.join(" ")).not.toMatch(/享年|战死|被杀/);
    expect(JSON.stringify(c.dynasty)).toBe(original);
    const extinction = deriveFactionAssessment(context())!;
    expect(extinction.voice).not.toContain("被鄄灭亡"); expect(extinction.evidence.remnantsDissipated).toBe(false);
  });
  it("uses the explicit old terminal event for remnants, never the earlier last-city conqueror", () => {
    const c = context(); c.events = [{ id: "end", year: 3600, type: "faction-extinct", category: "politics", importance: "major", title: "残部已经消散，王统断绝", targetFactionId: "a", factionIds: ["a"] }];
    expect(deriveFactionAssessment(c)!.evidence.remnantsDissipated).toBe(true);
    expect(deriveFactionAssessment(c)!.narrative.join(" ")).toContain("消散");
  });
  it("chooses different factual branches with deterministic variants and no RNG draws", () => {
    const c = context(), rng = worldRandom.exportState(), original = JSON.stringify(c);
    const first = deriveFactionAssessment(c)!; expect(deriveFactionAssessment(c)).toEqual(first);
    c.faction.restorationYears = [200, 400];
    const restored = deriveFactionAssessment(c)!; expect(restored.voice).not.toEqual(first.voice); expect(restored.lines[0]).toContain("复国2次");
    c.faction.restorationYears = [200]; expect(JSON.stringify(c)).toBe(original);
    expect(worldRandom.exportState()).toEqual(rng);
    const evidence = deriveFactionHistoricalEvidence(c); expect(classifyFactionHistoricalProfile(evidence).map(p => p.key)).toContain("EMPIRE");
  });
});
