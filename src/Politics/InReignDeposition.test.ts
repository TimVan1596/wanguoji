import { describe, expect, it } from "vitest";
import { evaluateDepositionOpportunity, getRecentDepositionEvidence, selectDepositionCandidates } from "./InReignDeposition";
import type { Ruler } from "./Dynasty";
import type { WorldEvent } from "../History/WorldHistory";

const ruler = (overrides: Partial<Ruler>): Ruler => ({ id: "r", houseName: "秦氏", givenName: "平", bornYear: -600,
  naturalDeathYear: 1200, status: "kin", ...overrides });
const crisis = (id: string, group: string, month: number, faction = "qin"): WorldEvent => ({
  id, year: month, monthIndex: month, type: "capital-fallen", category: "war", title: id,
  factionIds: ["enemy", faction], actorFactionId: "enemy", targetFactionId: faction,
  historyGroupId: group, importance: "major",
});

describe("InReignDeposition evidence and opportunity", () => {
  it("attributes shocks only to the affected faction and collapses one history group", () => {
    const events = [crisis("capture", "siege-1", 90), crisis("capital", "siege-1", 90), crisis("foreign", "foreign-war", 95, "wei")];
    expect(getRecentDepositionEvidence("qin", events, 100).map(e => e.eventId)).toEqual(["capture"]);
    expect(getRecentDepositionEvidence("qin", [crisis("stale", "stale", 63)], 100)).toEqual([]);
    expect(getRecentDepositionEvidence("qin", [crisis("future", "future", 101)], 100)).toEqual([]);
  });

  it("requires a pre-existing adult recorded close kin and caps priority candidates at two", () => {
    const current = ruler({ id: "current", bornYear: -600, accessionYear: 0, status: "ruling" });
    const children = ["child1", "child2", "child3"].map((id, index) => ruler({ id, bornYear: -400 - index * 12,
      parentId: current.id, status: "heir" }));
    const disqualified = [
      ruler({ id: "young", bornYear: -100, parentId: current.id, status: "heir" }),
      ruler({ id: "foreign-house", houseName: "魏氏", parentId: current.id, status: "kin" }),
      ruler({ id: "previous-ruler", parentId: current.id, status: "kin", reignOrdinal: 1 }),
      ruler({ id: "unknown-kin", parentId: undefined, status: "kin" }),
      ruler({ id: "dead", parentId: current.id, status: "dead", deathMonth: 1, deathReason: "去世" }),
    ];
    expect(selectDepositionCandidates({ currentRuler: current, rulers: [current, ...children, ...disqualified], houseName: "秦氏", worldMonth: 100 })
      .map(({ ruler: candidate }) => candidate.id)).toEqual(["child3", "child2"]);
  });

  it("separates current vulnerability, real crisis qualification, conservative/control risk and cooldown", () => {
    const current = ruler({ id: "current", accessionYear: 0, status: "ruling" });
    const kin = ruler({ id: "kin", bornYear: -400, parentId: current.id, status: "heir" });
    const events = [crisis("one", "one", 100)];
    const input = { factionId: "qin", status: "ACTIVE", identityStage: "STATE", cityCount: 3, stability: 40, currentRuler: current,
      rulers: [current, kin], houseName: "秦氏", worldMonth: 108, events };
    const conservative = evaluateDepositionOpportunity(input);
    const control = evaluateDepositionOpportunity({ ...input, riskGroup: "CONTROL" });
    expect(conservative).toMatchObject({ eligible: true, probability: 0.005 });
    expect(control).toMatchObject({ eligible: true, probability: 0.02 });
    expect(evaluateDepositionOpportunity({ ...input, stability: 41, cityCount: 3 }).blockers).toContain("NO_CURRENT_VULNERABILITY");
    expect(evaluateDepositionOpportunity({ ...input, events: [] }).blockers).toContain("NO_RECENT_REAL_CRISIS");
    expect(evaluateDepositionOpportunity({ ...input, identityStage: "PROVISIONAL" }).blockers).toContain("NOT_FORMAL_STATE");
    expect(evaluateDepositionOpportunity({ ...input, lastAttemptMonth: 60 }).blockers).toContain("COOLDOWN");
    expect(evaluateDepositionOpportunity({ ...input, cityCount: 1, stability: 90 }).eligible).toBe(true);
  });
});
