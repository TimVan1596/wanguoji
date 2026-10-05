import { afterEach, describe, expect, it, vi } from "vitest";
import type Team from "../Components/Team";

vi.mock("../Components/Team", () => ({ default: {} }));
vi.mock("../Game/Game", () => ({ default: { Core: { teams: [] } } }));
vi.mock("../Components/City", () => ({ getFactionStability: (team: { stability: number }) => team.stability }));
import Game from "../Game/Game";
import DynastyRegistry from "./Dynasty";
import worldRandom from "../Simulation/WorldRandom";
import WorldHistory from "../History/WorldHistory";

function setup() {
  DynastyRegistry.importState({ sequence: 1, dynasties: [{
    factionId: "rebel", houseName: "张氏", currentRulerId: "r1", heirIds: [],
    rulers: [{ id: "r1", houseName: "张氏", givenName: "平", bornYear: 0, accessionYear: 0, status: "ruling", chronicle: undefined }],
  }] });
  return { name: "rebel", sovereigntyRank: "LEADER", stability: 80,
    capitalCity: { underSiege: false }, cities: [], } as unknown as Team & { stability: number };
}

afterEach(() => { vi.restoreAllMocks(); DynastyRegistry.reset(); });

describe("authoritative dynasty battle hazard integration", () => {
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
    expect(next).toHaveBeenCalledTimes(1);
    const snapshot = JSON.parse(JSON.stringify(DynastyRegistry.exportState()));
    expect(snapshot.dynasties[0].rulers[0].lastBattleHazardCheckMonth).toBe(100);
    DynastyRegistry.importState(snapshot);
    for (let index = 0; index < 50; index += 1) {
      expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 100)).toBe(false);
    }
    expect(DynastyRegistry.handleRulerCombatDeath(team, "r1", 111)).toBe(false);
    expect(next).toHaveBeenCalledTimes(1);
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
