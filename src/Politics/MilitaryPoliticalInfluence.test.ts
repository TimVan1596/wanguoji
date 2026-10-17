import { describe, expect, it } from "vitest";
import { deriveMilitaryPoliticalInfluence, militaryPoliticalStrength, type MilitaryPoliticalEvidence } from "./MilitaryPoliticalInfluence";
import { evaluateDepositionOpportunity } from "./InReignDeposition";
import { evaluateDynasticRevolution } from "./DynasticRevolution";
import worldRandom from "../Simulation/WorldRandom";
import { MilitaryPoliticalDiagnostics } from "./MilitaryPoliticalDiagnostics";

function fixture() {
  const input: Parameters<typeof deriveMilitaryPoliticalInfluence>[0] = { factionId: "qin", status: "ACTIVE", identityStage: "STATE", worldMonth: 72, events: [],
    people: [{ personId: "military-person-1", sourceUserId: 1, name: "将甲", bornMonth: -300, factionId: "qin", status: "ACTIVE",
      appointments: [{ factionId: "qin", startMonth: 0, commandId: "military-command-1" }], capturedEventIds: [] }],
    formations: [{ commandId: "military-command-1", factionId: "qin", commanderPersonId: "military-person-1", createdMonth: 0,
      status: "ACTIVE", captures: [], memberUnitIds: ["unit-1", "unit-2", "unit-3", "unit-4"] }],
    users: [1, 2, 3, 4].map(id => ({ userId: id, name: id === 1 ? "将甲" : `人${id}`, bornMonth: -300, factionId: "qin",
      unitId: `unit-${id}`, personId: id === 1 ? "military-person-1" : undefined, liveBindingVerified: true })) };
  return input;
}
const ruler = { id: "old", houseName: "田氏", givenName: "平", bornYear: -600, accessionYear: 0, naturalDeathYear: 1200, status: "ruling" as const };
const heir = { id: "child", houseName: "田氏", givenName: "继", bornYear: -240, naturalDeathYear: 1200, parentId: "old", status: "heir" as const };
const crisis: any = { id: "loss", year: 70, monthIndex: 70, type: "capital-fallen", title: "敌军攻陷旧都", category: "war", importance: "major",
  actorFactionId: "enemy", targetFactionId: "qin", factionIds: ["enemy", "qin"], cityId: "old-capital", historyGroupId: "siege" };
function deposition(military?: MilitaryPoliticalEvidence) {
  return { factionId: "qin", status: "ACTIVE", identityStage: "STATE", cityCount: 1, stability: 20, currentRuler: ruler,
    rulers: [ruler, heir], houseName: "田氏", worldMonth: 72, events: [crisis], military };
}

describe("pure military political eligibility", () => {
  it("reports actor-checks separately from one political draw and compares the same baseline cohort without RNG", () => {
    const diagnostics = new MilitaryPoliticalDiagnostics(), input = deriveMilitaryPoliticalInfluence(fixture()), before = worldRandom.exportState();
    const two = { ...input, candidates: [...input.candidates, input.candidates[0]] };
    diagnostics.observe(two, true, .005, .01, true, true);
    diagnostics.observe(two, true, .005, .01, true, false);
    diagnostics.observe(undefined, true, .005, .005, true, true);
    expect(diagnostics.snapshot()).toMatchObject({ checks: 3, eligibleActorChecks: 4, draws: 2, riskChanged: 2,
      militarySuccesses: 1, militaryFailures: 1, nonMilitarySuccesses: 1, baselineExpected: .015, finalExpected: .025 });
    expect(worldRandom.exportState()).toEqual(before);
    diagnostics.reset(); expect(diagnostics.snapshot().draws).toBe(0);
  });
  it("separates real command, verified service and historical victories without drawing RNG", () => {
    const before = worldRandom.exportState(), input = fixture();
    expect(deriveMilitaryPoliticalInfluence(input).candidates[0]).toMatchObject({ serviceMonths: 72, unitCount: 4, capturedEventIds: [], strength: 2 });
    expect(worldRandom.exportState()).toEqual(before);
  });
  it.each(["provisional", "exiled", "retired", "dead", "foreign", "old", "missing-user", "wrong-name", "recycled-user", "unverified", "no-command", "no-members", "duplicate-person", "shared-unit"])("blocks %s evidence", mode => {
    const i = fixture(), p = i.people[0];
    if (mode === "provisional") i.identityStage = "PROVISIONAL";
    if (mode === "exiled") i.status = "EXILED";
    if (mode === "retired") p.status = "RETIRED";
    if (mode === "dead") { p.status = "DEAD"; p.deathMonth = 60; }
    if (mode === "foreign") p.factionId = "wei";
    if (mode === "old") { p.bornMonth = -1200; i.users[0].bornMonth = -1200; }
    if (mode === "missing-user") i.users.shift();
    if (mode === "wrong-name") i.users[0].name = "同名不能补造";
    if (mode === "recycled-user") i.users[0].bornMonth--;
    if (mode === "unverified") i.users[0].liveBindingVerified = false;
    if (mode === "no-command") i.formations[0].status = "DISBANDED";
    if (mode === "no-members") i.users.forEach(u => { u.liveBindingVerified = false; });
    if (mode === "duplicate-person") i.people.push(structuredClone(p));
    if (mode === "shared-unit") i.formations.push({ ...i.formations[0], commandId: "second" });
    expect(deriveMilitaryPoliticalInfluence(i).candidates).toHaveLength(0);
  });
  it("requires verified personal event links; fake IDs and world totals cannot qualify a novice", () => {
    const i = fixture(); i.worldMonth = 12; i.people[0].capturedEventIds = ["fake"];
    i.events.push({ ...crisis, id: "fake", type: "city-captured", actorFactionId: "qin", metadata: { commanderPersonId: "someone-else" } });
    expect(deriveMilitaryPoliticalInfluence(i).candidates).toHaveLength(0);
    expect(militaryPoliticalStrength(12000, 12, 12000).strength).toBe(3);
  });
  it("changes only an already eligible strong crisis and preserves baseline elsewhere", () => {
    const military = deriveMilitaryPoliticalInfluence(fixture());
    const base = evaluateDepositionOpportunity(deposition());
    const withMilitary = evaluateDepositionOpportunity(deposition(military));
    expect(base.probability).toBe(.005); expect(withMilitary.probability).toBe(.01);
    for (const changes of [{ events: [] }, { rulers: [ruler] }, { identityStage: "PROVISIONAL" }, { cityCount: 5, stability: 80 }, { lastAttemptMonth: 60 }]) {
      const result = evaluateDepositionOpportunity({ ...deposition(military), ...changes });
      expect(result.eligible).toBe(false); expect(result.militaryParticipant).toBeUndefined();
    }
    const weak = evaluateDepositionOpportunity({ ...deposition(military), stability: 40, events: [{ ...crisis, type: "city-captured" }] });
    expect(weak.probability).toBe(.005);
    const multiple = evaluateDepositionOpportunity({ ...deposition({ ...military, candidates: [...military.candidates, military.candidates[0]] }),
      events: [crisis, { ...crisis, id: "second", historyGroupId: "second" }, { ...crisis, id: "third", historyGroupId: "third" }] });
    expect(multiple.probability).toBeLessThanOrEqual(.03);
  });
  it("keeps stable succession blocked, uses one existing draw and respects each revolution tier's cap", () => {
    const military = deriveMilitaryPoliticalInfluence(fixture());
    const common = { worldMonth: 72, factionId: "qin", identityStage: "STATE", status: "ACTIVE", predecessor: ruler,
      successor: heir, successionReason: "natural" as const, previousSuccessionMonths: [], military };
    let draws = 0;
    expect(evaluateDynasticRevolution({ ...common, cityCount: 8, stability: 80 }, () => { draws++; return 0; }).rollAttempted).toBe(false);
    expect(draws).toBe(0);
    const context = { ...common, cityCount: 1, stability: 70, successionReason: "captured" as const };
    const base = evaluateDynasticRevolution({ ...context, military: undefined }, () => .04);
    const changed = evaluateDynasticRevolution(context, () => { draws++; return base.chance + .001; });
    expect(draws).toBe(1); expect(changed.usurpation).toBe(true); expect(changed.militaryBonus).toBeGreaterThan(0);
    expect(changed.chance).toBeLessThanOrEqual(.045);
    const capped = evaluateDynasticRevolution({ ...context, successor: { ...heir, bornYear: 0 }, previousSuccessionMonths: [10, 20, 30] }, () => 0);
    expect(capped.chance).toBeLessThanOrEqual(.18);
  });
});
