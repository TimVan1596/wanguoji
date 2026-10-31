import { describe, expect, it } from "vitest";
import type Team from "../Components/Team";
import { DiplomacyRegistry, DiplomacySystem } from "./Diplomacy";
import { createDiplomacyEventMetadata } from "./DiplomacyPresentation";
import type { WorldEvent } from "../History/WorldHistory";
import { diagnosePeacefulReunificationCandidates } from "../Simulation/PeacefulReunificationSystem";
import { areFactionsTerritoriallyAdjacent, areSameOriginFactions } from "./StrategicUnionRules";
import { findStrategicUnionCandidate } from "../Simulation/StrategicUnionSystem";
import worldRandom, { WorldRandom } from "../Simulation/WorldRandom";

// Stage A only: controlled geometry, real diplomacy evaluation, no injected treaties
// or battles. These are NOT naturally evolved worlds or balance measurements.
function run(seed: string, capped: boolean, loseContact = false, sameOrigin = true) {
  const random = new WorldRandom();
  random.initialize(seed);
  const counts = [5, random.int(10, 14), random.int(2, 7)];
  let offset = 0;
  const teams = counts.map((count, index) => {
    const start = offset;
    offset += count;
    return {
      name: ["a", "b", "c"][index], status: "ACTIVE", identityStage:"STATE", isDie: false,
      origin: index === 2 && sameOrigin ? { type: "SPLIT", parentFactionId: "b" } : { type: "INITIAL" },
      cities: [{ loyalty: 80 }],
      blocks: { children: { size: count, entries: Array.from({ length: count }, (_, i) => ({ x: start + i, y: 0 })) } },
    } as unknown as Team;
  });
  if (!capped) teams.shift();
  teams.push({ name: "z", status: "ACTIVE", isDie: false, origin: { type: "INITIAL" }, cities: [{ loyalty: 80 }],
    blocks: { children: { size: 80, entries: Array.from({ length: 80 }, (_, x) => ({ x, y: 1 })) } },
  } as unknown as Team);
  const registry = new DiplomacyRegistry();
  const emissions: string[] = [];
  const history:WorldEvent[]=[];
  const system = new DiplomacySystem(registry, () => [], e => {
    emissions.push(e.type);
    history.push({id:`${e.type}-${e.relation.factionAId}-${e.relation.factionBId}-${e.month}`,year:e.month,monthIndex:e.month,
      type:e.type,category:"politics",title:"外交记录",importance:"normal",factionIds:[e.relation.factionAId,e.relation.factionBId],
      metadata:createDiplomacyEventMetadata(e.relation,e.triggerContext)});
  }, 1);
  const observations = { sameOriginNapChecks: 0, nap10Years: 0, nap15Years: 0,
    oldAllianceEligibleChecks: 0, firstAllianceMonth: undefined as number | undefined,
    renewedNapChecks: 0, implementedEligibleChecks:0, hypotheses: {} as Record<string, number> };
  const before = worldRandom.exportState();
  for (let month = 12; month <= 300; month += 12) {
    // Explicit controlled contact removal, not a simulated war/territory change.
    if (loseContact && month === 24) teams[teams.length - 1].blocks.children.entries.forEach((block: unknown) => {
      (block as { y: number }).y = 100;
    });
    system.update(month, teams, 200, []);
    observations.implementedEligibleChecks += diagnosePeacefulReunificationCandidates({teams,relations:registry.list(month),
      totalCells:200,worldMonth:month,blockSize:1,getRelationEvents:()=>history}).filter(r=>r.candidate).length;
    const b = teams.find(t => t.name === "b")!, c = teams.find(t => t.name === "c")!;
    const relation = registry.get("b", "c");
    if (relation?.status === "ALLIANCE" && observations.firstAllianceMonth === undefined) observations.firstAllianceMonth = month;
    if (findStrategicUnionCandidate({ teams, relations: registry.list(month), totalCells: 200, worldMonth: month,
      recentEvents: [], blockSize: 1 })) observations.oldAllianceEligibleChecks++;
    if (!relation || relation.status !== "NON_AGGRESSION" || relation.expiresMonth <= month || !areSameOriginFactions(b, c)) continue;
    observations.sameOriginNapChecks++;
    const age = month - relation.startedMonth;
    if (age >= 120) observations.nap10Years++;
    if (age >= 180) observations.nap15Years++;
    if (relation.renewalCount > 0) observations.renewedNapChecks++;
    // Read-only parameter matrix. Peace is known here because this test supplies
    // the ENTIRE observation period with no battles, not a truncated 60-month query.
    for (const years of [10, 15]) for (const ratio of [0.35, 0.6]) for (const maxCities of [1, 2]) {
      for (const requirePressure of [true, false]) {
        const key = `${years}y/ratio${ratio}/cities${maxCities}/pressure${requirePressure}`;
        observations.hypotheses[key] ??= 0;
        const threatContact = relation.commonThreatFactionId === "z" &&
          80 >= Math.max(b.blocks.children.size, c.blocks.children.size) * 2.5 &&
          areFactionsTerritoriallyAdjacent(b, teams[teams.length - 1], 1) &&
          areFactionsTerritoriallyAdjacent(c, teams[teams.length - 1], 1);
        if (age >= years * 12 && month >= 120 && areFactionsTerritoriallyAdjacent(b, c, 1) &&
          c.blocks.children.size <= b.blocks.children.size * ratio && c.cities.length <= maxCities &&
          c.cities.length <= b.cities.length && (!requirePressure || threatContact)) observations.hypotheses[key]++;
      }
    }
  }
  expect(worldRandom.exportState()).toEqual(before);
  return { counts, observations, emissions, state: registry.exportState() };
}

describe("same-origin NAP reachability — read-only Stage A", () => {
  it("creates real NAPs but upgrades to alliance after two years of severe common pressure", () => {
    const result = run("nap-audit-1", false);
    expect(result.observations.firstAllianceMonth).toBe(37);
    expect(result.observations.sameOriginNapChecks).toBe(2);
    expect(result.observations.nap10Years).toBe(0);
    expect(result.observations.oldAllianceEligibleChecks).toBeGreaterThan(0);
    expect(result.emissions).toContain("alliance-signed");
  });

  it("lets an actual alliance cap preserve and renew a second NAP beyond fifteen years", () => {
    const result = run("nap-audit-1", true);
    expect(result.observations.firstAllianceMonth).toBeUndefined();
    expect(result.observations.nap10Years).toBeGreaterThan(0);
    expect(result.observations.nap15Years).toBeGreaterThan(0);
    expect(result.observations.renewedNapChecks).toBeGreaterThan(0);
    expect(result.observations.oldAllianceEligibleChecks).toBe(0);
    expect(result.state.relations.find(r => r.factionAId === "b" && r.factionBId === "c")).toMatchObject({
      status: "NON_AGGRESSION", reason: "COMMON_THREAT_NON_AGGRESSION", startedMonth: 24, commonThreatFactionId: "z",
    });
  });

  it("does not renew a NAP after genuine contact evidence is removed", () => {
    const result = run("nap-audit-1", false, true);
    expect(result.observations.firstAllianceMonth).toBeUndefined();
    expect(result.observations.nap15Years).toBe(0);
    expect(result.emissions).not.toContain("relation-renewed");
    expect(result.emissions).toContain("treaty-expired");
    expect(result.observations.hypotheses["10y/ratio0.35/cities1/pressuretrue"]).toBe(0);
    expect(result.observations.hypotheses["10y/ratio0.35/cities1/pressurefalse"]).toBeGreaterThan(0);
  });

  it("never counts unrelated long NAPs as same-origin opportunities", () => {
    const result = run("nap-audit-1", true, false, false);
    expect(result.state.relations.find(r => r.factionAId === "b" && r.factionBId === "c")?.status).toBe("NON_AGGRESSION");
    expect(result.observations.sameOriginNapChecks).toBe(0);
    expect(result.observations.hypotheses).toEqual({});
  });

  it("repeats the real political evaluation for four reproducible controlled seeds", () => {
    const results = [1, 2, 3, 4].map(n => {
      const seed = `nap-audit-${n}`;
      const ordinary = run(seed, false), capped = run(seed, true);
      expect(run(seed, true)).toEqual(capped);
      expect(capped.observations.hypotheses["10y/ratio0.6/cities1/pressuretrue"]).toBeGreaterThan(0);
      expect(capped.observations.implementedEligibleChecks).toBe(capped.observations.hypotheses["10y/ratio0.35/cities1/pressuretrue"]);
      return { seed, controlledYears: 25, counts: capped.counts,
        ordinaryNapChecks: ordinary.observations.sameOriginNapChecks,
        ordinaryOldAllianceEligibleChecks: ordinary.observations.oldAllianceEligibleChecks,
        cappedNapChecks: capped.observations.sameOriginNapChecks,
        cappedNap10Years: capped.observations.nap10Years, cappedNap15Years: capped.observations.nap15Years,
        implementedEligibleChecks:capped.observations.implementedEligibleChecks,
        strict10YearCandidates: capped.observations.hypotheses["10y/ratio0.35/cities1/pressuretrue"],
        relaxed10YearCandidates: capped.observations.hypotheses["10y/ratio0.6/cities1/pressuretrue"] };
    });
    console.info("固定种子受控外交对照（未运行完整自然世界，不是发生率）", JSON.stringify(results));
  });
});
