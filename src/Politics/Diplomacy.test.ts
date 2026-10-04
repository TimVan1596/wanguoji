import { afterEach, describe, expect, it } from "vitest";
import Diplomacy, { DiplomacyRegistry, DiplomacySystem, diplomaticPairKey, isHostileActionAllowed } from "./Diplomacy";

function faction(name: string, blocks: number, loyalty = 50, status = "ACTIVE") {
  return {
    name, status, isDie: status !== "ACTIVE",
    blocks: { children: new Set(Array.from({ length: blocks }, (_, i) => `${name}-${i}`)) },
    cities: blocks ? [{ loyalty }] : [],
  } as never;
}

afterEach(() => Diplomacy.reset());

describe("Diplomacy", () => {
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

  it("routes hostile occupation and siege attempts through the shared permission check", () => {
    Diplomacy.setRelation({ factionAId: "a", factionBId: "b", status: "TRUCE", startedMonth: 0, expiresMonth: 10, reason: "WAR_EXHAUSTION_TRUCE" });
    expect(isHostileActionAllowed(Diplomacy, "a", "b", 1, "HOSTILE_OCCUPATION")).toBe(false);
    expect(isHostileActionAllowed(Diplomacy, "b", "a", 1, "SIEGE_CONTACT")).toBe(false);
    expect(Diplomacy.getDiagnostics(1)).toMatchObject({ blockedHostileOccupationCount: 1, blockedSiegeContactCount: 1 });
    expect(isHostileActionAllowed(Diplomacy, "a", "b", 10, "HOSTILE_OCCUPATION")).toBe(true);
  });

  it("signs bounded war-exhaustion truces and clears existing siege contacts", () => {
    const cleared: string[][] = [];
    const events: Array<{ type: string }> = [];
    const system = new DiplomacySystem(Diplomacy, () => [{ clearSiegeContactBetween: (a: string, b: string) => cleared.push([a, b]) } as never], (event) => events.push(event));
    const teams = [faction("a", 10, 40), faction("b", 9, 55)];
    system.update(12, teams, 100, [{ type: "city-captured", actorFactionId: "a", targetFactionId: "b" } as never]);
    expect(Diplomacy.get("b", "a")).toMatchObject({ status: "TRUCE", reason: "WAR_EXHAUSTION_TRUCE", expiresMonth: 36 });
    expect(Diplomacy.canAttack("b", "a", 12)).toBe(false);
    expect(cleared).toEqual([["a", "b"]]);
    expect(events[0].type).toBe("truce-signed");
  });

  it("forms a common-threat non-aggression pact only among active weaker factions", () => {
    const events: Array<{ type: string }> = [];
    const system = new DiplomacySystem(Diplomacy, () => [], (event) => events.push(event));
    system.update(12, [faction("small-a", 5), faction("small-b", 5), faction("power", 70), faction("exiled", 4, 50, "EXILED")], 100);
    expect(Diplomacy.get("small-a", "small-b")?.status).toBe("NON_AGGRESSION");
    expect(Diplomacy.list()).toHaveLength(1);
    expect(events[0].type).toBe("non-aggression-signed");
  });

  it("expires treaties and emits expiry once", () => {
    const events: Array<{ type: string }> = [];
    const system = new DiplomacySystem(Diplomacy, () => [], (event) => events.push(event));
    Diplomacy.setRelation({ factionAId: "a", factionBId: "b", status: "TRUCE", startedMonth: 1, expiresMonth: 12, reason: "WAR_EXHAUSTION_TRUCE" });
    system.update(12, [], 100, []);
    system.update(13, [], 100, []);
    expect(Diplomacy.list()).toHaveLength(0);
    expect(events.filter((event) => event.type === "treaty-expired")).toHaveLength(1);
  });

  it("round-trips canonical relations and produces a stable same-input diplomacy projection", () => {
    const relation = { factionAId: "a", factionBId: "b", status: "NON_AGGRESSION" as const, startedMonth: 12, expiresMonth: 72, reason: "COMMON_THREAT_NON_AGGRESSION" as const };
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
