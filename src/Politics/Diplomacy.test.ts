import { afterEach, describe, expect, it } from "vitest";
import Diplomacy, { DiplomacyRegistry, DiplomacySystem, diplomaticPairKey, isHostileActionAllowed } from "./Diplomacy";
import { DIPLOMACY_NON_AGGRESSION_DURATION_MONTHS, DIPLOMACY_TRUCE_DURATION_MONTHS } from "./Diplomacy";
import { areFactionsTerritoriallyAdjacent } from "./StrategicUnionRules";

function faction(name: string, blocks: number, loyalty = 50, status = "ACTIVE") {
  return {
    name, status, isDie: status !== "ACTIVE",
    blocks: { children: new Set(Array.from({ length: blocks }, (_, i) => `${name}-${i}`)) },
    cities: blocks ? [{ loyalty }] : [],
  } as never;
}

function territoryFaction(name: string, coordinates: Array<{ x: number; y: number }>, parentFactionId: string) {
  return {
    name, displayName: name, status: "ACTIVE", isDie: false, identityStage: "STATE",
    origin: { type: "SPLIT", parentFactionId },
    blocks: { children: { size: coordinates.length, entries: coordinates } },
    cities: [{ loyalty: 60 }],
  } as never;
}

afterEach(() => Diplomacy.reset());

describe("Diplomacy", () => {
  it("uses the longer canonical truce and non-aggression durations", () => {
    expect(DIPLOMACY_TRUCE_DURATION_MONTHS).toBe(36);
    expect(DIPLOMACY_NON_AGGRESSION_DURATION_MONTHS).toBe(96);
  });
  it("normalizes unordered pair keys and blocks both sides until expiry", () => {
    expect(diplomaticPairKey("wei", "qi")).toBe(diplomaticPairKey("qi", "wei"));
    Diplomacy.setRelation({ factionAId: "wei", factionBId: "qi", status: "TRUCE", startedMonth: 4, expiresMonth: 20, reason: "WAR_EXHAUSTION_TRUCE" });
    expect(Diplomacy.canAttack("wei", "qi", 19)).toBe(false);
    expect(Diplomacy.canAttack("qi", "wei", 19)).toBe(false);
    expect(Diplomacy.canAttack("wei", "qi", 20)).toBe(true);
    expect(Diplomacy.canAttack("wei", "wei", 2)).toBe(false);
  });

  it("also blocks NON_AGGRESSION symmetrically", () => {
    Diplomacy.setRelation({ factionAId: "a", factionBId: "b", status: "NON_AGGRESSION", startedMonth: 0, expiresMonth: 60, reason: "COMMON_THREAT_NON_AGGRESSION" });
    expect(Diplomacy.canAttack("a", "b", 1)).toBe(false);
    expect(Diplomacy.canAttack("b", "a", 1)).toBe(false);
  });

  it("requires an aged non-aggression pact and real common-threat contact before alliance, without requiring A/B adjacency", () => {
    const events: Array<{ type: string; triggerContext?: unknown }> = [];
    const system = new DiplomacySystem(Diplomacy, () => [], (event) => events.push(event), 1);
    const a = territoryFaction("a", [{ x: 0, y: 0 }], "house");
    const b = territoryFaction("b", [{ x: 4, y: 0 }], "house");
    const threat = territoryFaction("threat", [
      { x: 1, y: 0 }, { x: 3, y: 0 },
      ...Array.from({ length: 38 }, (_, index) => ({ x: 10 + index, y: 5 })),
    ], "other");
    const teams = [a, b, threat];
    system.update(12, teams, 80, []);
    expect(Diplomacy.get("a", "b")?.status).not.toBe("ALLIANCE");
    Diplomacy.setRelation({ factionAId: "a", factionBId: "b", status: "NON_AGGRESSION", startedMonth: 0, expiresMonth: 120, reason: "COMMON_THREAT_NON_AGGRESSION", commonThreatFactionId: "threat" });
    system.update(12, teams, 80, []);
    expect(Diplomacy.get("a", "b")?.status).toBe("NON_AGGRESSION");
    system.update(24, teams, 80, []);
    expect(Diplomacy.get("a", "b")).toMatchObject({
      status: "ALLIANCE", startedMonth: 24, expiresMonth: 24 + 168,
      commonThreatFactionId: "threat", preconditionStatus: "NON_AGGRESSION", preconditionDurationMonths: 24,
    });
    expect(Diplomacy.canAttack("a", "b", 24)).toBe(false);
    expect(Diplomacy.canAttack("b", "a", 24)).toBe(false);
    expect(areFactionsTerritoriallyAdjacent(a, b, 1)).toBe(false);
    expect(events.some(({ type }) => type === "alliance-signed")).toBe(true);
  });

  it("limits a faction to one strategic alliance and expires alliance terms", () => {
    const events: string[] = [];
    const system = new DiplomacySystem(Diplomacy, () => [], ({ type }) => events.push(type));
    Diplomacy.setRelation({ factionAId: "a", factionBId: "b", status: "ALLIANCE", startedMonth: 0, expiresMonth: 120, reason: "COMMON_THREAT_ALLIANCE" });
    Diplomacy.setRelation({ factionAId: "a", factionBId: "c", status: "NON_AGGRESSION", startedMonth: 0, expiresMonth: 200, reason: "COMMON_THREAT_NON_AGGRESSION" });
    const staleTeam = (name: string) => ({ name, status: "ACTIVE", isDie: false, blocks: { children: { size: 1, entries: [{ x: 0, y: 0 }] } }, cities: [], origin: { type: "REBEL", parentFactionId: "p" } } as never);
    system.update(120, [staleTeam("a"), staleTeam("b"), staleTeam("c"), faction("power", 80)], 100, []);
    expect(events).toContain("alliance-expired");
    expect(Diplomacy.get("a", "b")).toBeUndefined();
  });

  it("routes hostile occupation and siege attempts through the shared permission check", () => {
    Diplomacy.setRelation({ factionAId: "a", factionBId: "b", status: "TRUCE", startedMonth: 0, expiresMonth: 10, reason: "WAR_EXHAUSTION_TRUCE" });
    expect(isHostileActionAllowed(Diplomacy, "a", "b", 1, "HOSTILE_OCCUPATION")).toBe(false);
    expect(isHostileActionAllowed(Diplomacy, "b", "a", 1, "SIEGE_CONTACT")).toBe(false);
    expect(Diplomacy.getDiagnostics(1)).toMatchObject({ blockedHostileOccupationCount: 1, blockedSiegeContactCount: 1 });
    expect(isHostileActionAllowed(Diplomacy, "a", "b", 10, "HOSTILE_OCCUPATION")).toBe(true);
  });

  it("signs bounded war-exhaustion truces and clears existing siege contacts", () => {
    const cleared: string[][] = [];
    const events: Array<{ type: string; triggerContext?: unknown }> = [];
    const system = new DiplomacySystem(Diplomacy, () => [{ clearSiegeContactBetween: (a: string, b: string) => cleared.push([a, b]) } as never], (event) => events.push(event));
    const teams = [faction("a", 10, 40), faction("b", 9, 55)];
    system.update(12, teams, 100, [{ type: "city-captured", actorFactionId: "a", targetFactionId: "b" } as never]);
    expect(Diplomacy.get("b", "a")).toMatchObject({ status: "TRUCE", reason: "WAR_EXHAUSTION_TRUCE", startedMonth: 12, expiresMonth: 48 });
    expect(Diplomacy.canAttack("b", "a", 12)).toBe(false);
    expect(cleared).toEqual([["a", "b"]]);
    expect(events[0].type).toBe("truce-signed");
    expect(events[0]).toMatchObject({ triggerContext: { reason: "WAR_EXHAUSTION_TRUCE", recentBilateralCaptureCount: 1, stabilityA: 40, stabilityB: 55 } });
  });

  it("forms a common-threat non-aggression pact only among active weaker factions", () => {
    const events: Array<{ type: string; triggerContext?: unknown }> = [];
    const system = new DiplomacySystem(Diplomacy, () => [], (event) => events.push(event));
    system.update(12, [faction("small-a", 5, 80), faction("small-b", 5, 80), faction("power", 70, 80), faction("exiled", 4, 50, "EXILED")], 100, [
      {type:"city-captured",actorFactionId:"power",targetFactionId:"small-a"} as never,
      {type:"city-captured",actorFactionId:"power",targetFactionId:"small-b"} as never,
    ]);
    expect(Diplomacy.get("small-a", "small-b")?.status).toBe("NON_AGGRESSION");
    expect(Diplomacy.get("small-a", "small-b")?.expiresMonth).toBe(144);
    expect(events[0]).toMatchObject({ triggerContext: {
      reason: "COMMON_THREAT_NON_AGGRESSION", commonThreatFactionId: "power",
      territoryShareA: 6.25, territoryShareB: 6.25, threatTerritoryShare: 87.5,
    } });
    expect(Diplomacy.list()).toHaveLength(1);
    expect(events[0].type).toBe("non-aggression-signed");
  });

  it("expires treaties and emits expiry once", () => {
    const events: Array<{ type: string; triggerContext?: unknown }> = [];
    const system = new DiplomacySystem(Diplomacy, () => [], (event) => events.push(event));
    Diplomacy.setRelation({ factionAId: "a", factionBId: "b", status: "TRUCE", startedMonth: 1, expiresMonth: 12, reason: "WAR_EXHAUSTION_TRUCE" });
    system.update(12, [], 100, []);
    system.update(13, [], 100, []);
    expect(Diplomacy.list()).toHaveLength(0);
    expect(events.filter((event) => event.type === "treaty-expired")).toHaveLength(1);
  });

  it("round-trips canonical relations and produces a stable same-input diplomacy projection", () => {
    const relation = { factionAId: "a", factionBId: "b", status: "NON_AGGRESSION" as const, startedMonth: 12, expiresMonth: 108, reason: "COMMON_THREAT_NON_AGGRESSION" as const };
    Diplomacy.setRelation(relation);
    Diplomacy.lastEvaluationMonth = 12;
    const snapshot = JSON.parse(JSON.stringify(Diplomacy.exportState()));
    Diplomacy.reset();
    Diplomacy.importState(snapshot);
    expect(Diplomacy.exportState()).toEqual(snapshot);
    expect(Diplomacy.canAttack("b", "a", 13)).toBe(false);

    const project = () => {
      const registry = new DiplomacyRegistry();
      const system = new DiplomacySystem(registry, () => [], () => undefined);
      system.update(12, [faction("small-a", 5), faction("small-b", 5), faction("power", 70)], 100, []);
      return registry.exportState();
    };
    expect(project()).toEqual(project());
  });
});
