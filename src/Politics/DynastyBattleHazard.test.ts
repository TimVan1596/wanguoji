import { afterEach, describe, expect, it, vi } from "vitest";
import type Team from "../Components/Team";

vi.mock("../Components/Team", () => ({ default: {} }));
vi.mock("../Components/Block", () => ({ default: {} }));
vi.mock("../Game/Game", () => ({ default: { Core: { teams: [] } } }));
vi.mock("../Components/City", () => ({ getFactionStability: (team: { stability: number }) => team.stability }));
import Game from "../Game/Game";
import DynastyRegistry from "./Dynasty";
import worldRandom from "../Simulation/WorldRandom";
import WorldHistory from "../History/WorldHistory";
import Diplomacy from "./Diplomacy";

function setup() {
  DynastyRegistry.importState({ sequence: 1, dynasties: [{
    factionId: "rebel", houseName: "张氏", currentRulerId: "r1", heirIds: [], houseEpochs: [],
    rulers: [{ id: "r1", houseName: "张氏", givenName: "平", bornYear: 0, accessionYear: 0, status: "ruling", chronicle: undefined }],
  }] });
  return { name: "rebel", sovereigntyRank: "LEADER", stability: 80,
    capitalCity: { underSiege: false }, cities: [], } as unknown as Team & { stability: number };
}

afterEach(() => { vi.restoreAllMocks(); DynastyRegistry.reset(); });

describe("authoritative dynasty battle hazard integration", () => {
  it("writes personal participation only from accepted City ruler contacts", async () => {
    const team = setup();
    const { default: City } = await vi.importActual<typeof import("../Components/City")>("../Components/City");
    const city = Object.create(City.prototype) as InstanceType<typeof City>;
    Object.assign(city, { ownerFactionId: "enemy", siegeContacts: new Map(), lastCapturedYear: undefined });
    (Game.Core as unknown as { teams: unknown[] }).teams = [team, { name: "enemy" }];
    const allowed = vi.spyOn(Diplomacy, "canAttack").mockReturnValue(true);
    const ruler = DynastyRegistry.getCurrentRuler(team.name)!;
    city.registerSiegeContact(team, 100);
    expect(ruler.lastPersonalSiegeContactMonth).toBeUndefined();
    city.registerSiegeContact(team, 100, "someone-else");
    expect(ruler.lastPersonalSiegeContactMonth).toBeUndefined();
    city.registerSiegeContact(team, 100, "r1");
    expect(ruler.lastPersonalSiegeContactMonth).toBe(100);
    // Monthly contact clearing cannot erase the bounded personal evidence.
    (city as unknown as { siegeContacts: Map<string, unknown> }).siegeContacts.clear();
    expect(ruler.lastPersonalSiegeContactMonth).toBe(100);
    allowed.mockReturnValue(false);
    city.registerSiegeContact(team, 101, "r1");
    expect(ruler.lastPersonalSiegeContactMonth).toBe(100);
    allowed.mockReturnValue(true);
    city.lastCapturedYear = 102;
    city.registerSiegeContact(team, 102, "r1");
    expect(ruler.lastPersonalSiegeContactMonth).toBe(100);
  });

  it("does not expose any rank merely because its army or unrelated factions besiege a city", () => {
    const next = vi.spyOn(worldRandom, "next").mockReturnValue(0);
    for (const rank of ["LEADER", "KING", "EMPEROR"] as const) {
      const team = setup();
      team.sovereigntyRank = rank;
      (Game.Core as unknown as { teams: unknown[] }).teams = [{ cities: [
        { underSiege: true, ownerTeam: {}, attackingFactionId: "rebel" },
        { underSiege: true, ownerTeam: {}, attackingFactionId: "unrelated" },
      ] }];
      DynastyRegistry.recordPersonalSiegeContact("unrelated", "r1", 100);
      expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 100)).toBe(false);
      expect(DynastyRegistry.getCurrentRuler(team.name)!.lastBattleHazardCheckMonth).toBeUndefined();
    }
    expect(next).not.toHaveBeenCalled();
  });

  it("resumes real exposure eligibility and RNG deterministically after registry JSON restore", () => {
    const original = worldRandom.exportState();
    vi.spyOn(DynastyRegistry as unknown as { succeedRuler: (...args: unknown[]) => void }, "succeedRuler")
      .mockImplementation(() => undefined);
    const run = () => {
      const team = setup();
      worldRandom.initialize("personal-siege-exposure");
      DynastyRegistry.recordPersonalSiegeContact(team.name, "r1", 100);
      const snapshot = JSON.parse(JSON.stringify({ dynasty: DynastyRegistry.exportState(), rng: worldRandom.exportState() }));
      const evaluate = () => [100, 101, 102, 112].map((month) => DynastyRegistry.handleRulerCombatDeath(team, "r1", month));
      const expected = evaluate();
      const expectedRng = worldRandom.exportState();
      DynastyRegistry.importState(snapshot.dynasty);
      worldRandom.restore(snapshot.rng);
      expect(evaluate()).toEqual(expected);
      expect(worldRandom.exportState()).toEqual(expectedRng);
      return { expected, expectedRng };
    };
    try { expect(run()).toEqual(run()); }
    finally { worldRandom.restore(original); }
  });
  it("keeps captured-ruler execution separate from combat cooldown and random risk", () => {
    const team = setup();
    DynastyRegistry.getCurrentRuler("rebel")!.lastBattleHazardCheckMonth = 100;
    const succeed = vi.spyOn(DynastyRegistry as unknown as { succeedRuler: (...args: unknown[]) => void }, "succeedRuler")
      .mockImplementation(() => undefined);
    vi.spyOn(WorldHistory, "addRulerCaptured").mockReturnValue("captured-event");
    const next = vi.spyOn(worldRandom, "next");
    DynastyRegistry.resolveCapturedRuler(team, { name: "enemy" } as Team, 100);
    expect(succeed).toHaveBeenCalledOnce();
    expect(succeed.mock.calls[0].at(-1)).toBe("captured");
    expect(next).not.toHaveBeenCalled();
  });
  it("derives siege facts and suppresses duplicate collision rolls across a registry JSON restore", () => {
    const team = setup();
    const next = vi.spyOn(worldRandom, "next").mockReturnValue(0.99);
    expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 100)).toBe(false);
    expect(next).not.toHaveBeenCalled();
    team.capitalCity!.underSiege = true;
    expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 100)).toBe(false);
    expect(next).not.toHaveBeenCalled();
    DynastyRegistry.recordPersonalSiegeContact(team.name, "r1", 100);
    expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 100)).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
    const snapshot = JSON.parse(JSON.stringify(DynastyRegistry.exportState()));
    expect(snapshot.dynasties[0].rulers[0].lastBattleHazardCheckMonth).toBe(100);
    expect(snapshot.dynasties[0].rulers[0].lastPersonalSiegeContactMonth).toBe(100);
    DynastyRegistry.importState(snapshot);
    for (let index = 0; index < 50; index += 1) {
      expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 100)).toBe(false);
    }
    expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 111)).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
    expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 112)).toBe(false);
    expect(next).toHaveBeenCalledTimes(1); // Old participation expired independently of hazard cooldown.
    DynastyRegistry.recordPersonalSiegeContact(team.name, "r1", 112);
    expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 112)).toBe(false);
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("allows natural combat outcomes in siege command and preserves severe collapse bypass", () => {
    const team = setup();
    // Observe the existing succession transition instead of constructing a second simulator.
    const succeed = vi.spyOn(DynastyRegistry as unknown as { succeedRuler: (...args: unknown[]) => void }, "succeedRuler")
      .mockImplementation(() => undefined);
    const next = vi.spyOn(worldRandom, "next").mockReturnValue(0);
    const core = Game.Core as unknown as { teams: unknown[] };
    core.teams = [{ cities: [{ ownerTeam: {}, underSiege: true, attackingFactionId: "rebel" }] }] as never;
    expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 100)).toBe(false);
    expect(next).not.toHaveBeenCalled();
    DynastyRegistry.recordPersonalSiegeContact(team.name, "r1", 100);
    expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 100)).toBe(true);
    expect(succeed.mock.calls[0].at(-1)).toBe("combat");
    expect(next).toHaveBeenCalledTimes(1);
    core.teams = [];
    team.capitalCity!.underSiege = true;
    team.stability = 25;
    expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 101)).toBe(true);
    expect(succeed).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1); // Severe collapse does not become a probabilistic rescue.
  });
});
