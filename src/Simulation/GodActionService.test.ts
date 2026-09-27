import { beforeEach, describe, expect, it, vi } from "vitest";

const { core } = vi.hoisted(() => ({ core: { simulator: undefined as any, teams: [] as any[] } }));
vi.mock("../Game/Game", () => ({ default: { Core: core } }));
vi.mock("../Components/City", () => ({ default: class CityMock {}, getFactionStability: (team: any) => team.cities.length ? Math.round(team.cities.reduce((total: number, city: any) => total + city.loyalty, 0) / team.cities.length) : undefined }));
vi.mock("../Politics/Dynasty", () => ({ default: { hasClaimant: () => false } }));
vi.mock("./WorldRemnants", () => ({ default: { get: () => undefined } }));
vi.mock("./FactionRegistry", () => ({ default: { canRestoreFaction: () => false } }));

import type City from "../Components/City";
import Team from "../Components/Team";
import GodActionService, { canRunGodMutation, resolveGodFactionTarget } from "./GodActionService";
import { createEmptyWorldSaveV1 } from "../Persistence/WorldSaveSchema";
import { validateWorldSave } from "../Persistence/WorldSaveValidator";

function fakeCity(overrides: Record<string, unknown> = {}) {
  return {
    id: "city-1", name: "蓟", ownerFactionId: "燕", founderFactionId: "燕", destroyed: false,
    loyalty: 50, defense: 2, maxDefense: 5, devastation: 0, fortifiedCells: [],
    block: { updateCityDisplay: vi.fn() }, isInCaptureGrace: () => false,
    ...overrides,
  } as unknown as City;
}

describe("GodActionService canonical interventions", () => {
  beforeEach(() => {
    core.teams = [];
    core.simulator = undefined;
  });

  it("requires explicit target and allows paused worlds while respecting mutation locks", () => {
    const teams = [{ name: "first" }, { name: "selected" }];
    expect(resolveGodFactionTarget(teams)).toBeUndefined();
    expect(resolveGodFactionTarget(teams, "missing")).toBeUndefined();
    expect(resolveGodFactionTarget(teams, "selected")).toBe(teams[1]);
    expect(canRunGodMutation({ worldStarted: true, saving: false, backgroundCatchUpActive: false })).toBe(true);
    expect(canRunGodMutation({ worldStarted: true, saving: true, backgroundCatchUpActive: false })).toBe(false);
    expect(canRunGodMutation({ worldStarted: true, saving: false, backgroundCatchUpActive: true })).toBe(false);
    expect(canRunGodMutation({ worldStarted: false, saving: false, backgroundCatchUpActive: false })).toBe(false);
  });

  it("rejects missing faction targets and permits action while paused without resuming", () => {
    const spawn = vi.fn(() => 3);
    core.simulator = { godAddPopulation: spawn, isRunning: () => false };
    expect(GodActionService.addPopulation(undefined, 5).success).toBe(false);
    expect(spawn).not.toHaveBeenCalled();
    const team = { name: "燕", displayName: "燕", isDie: false, users: new Set([{}, {}, {}]), cities: [] } as unknown as Team;
    const result = GodActionService.addPopulation(team, 5);
    expect(result.success).toBe(true);
    expect(result.affectedCount).toBe(3);
    expect(core.simulator.isRunning()).toBe(false);
  });

  it("derives stability from clamped city loyalty without adding a team stability field", () => {
    const cityA = fakeCity({ loyalty: 90 });
    const cityB = fakeCity({ id: "city-2", loyalty: 95 });
    const team: any = { name: "燕", isDie: false, cities: [cityA, cityB] };
    const result = GodActionService.changeStability(team, 20);
    expect(result.before.stability).toBe(93);
    expect(result.after.stability).toBe(95);
    expect(result.after.requestedDelta).toBe(20);
    expect(team).not.toHaveProperty("stability");
    expect(GodActionService.changeStability({ ...team, cities: [] }, 5).success).toBe(false);
  });

  it("clamps city actions and refreshes City defense projection without changing block HP", () => {
    const block = { hp: 8, updateCityDisplay: vi.fn() };
    const fortress = { updateCityDisplay: vi.fn() };
    const city = fakeCity({ loyalty: 90, defense: 4, devastation: 95, block, fortifiedCells: [fortress] });
    expect(GodActionService.changeCity(city, "loyalty", "delta", 10).after.loyalty).toBe(95);
    expect(GodActionService.changeCity(city, "defense", "delta", 1).after.defense).toBe(5);
    expect(fortress.updateCityDisplay).toHaveBeenCalled();
    expect(block.hp).toBe(8);
    expect(GodActionService.changeCity(city, "devastation", "delta", 10).after.devastation).toBe(99);
    expect(validateWorldSave(createEmptyWorldSaveV1()).valid).toBe(true);
  });

  it("delegates rebellion and restoration to the existing simulator domain APIs", () => {
    const city = fakeCity();
    const foundRebelByGod = vi.fn(() => true);
    const restoreFactionByGod = vi.fn(() => true);
    core.simulator = { foundRebelByGod, restoreFactionByGod };
    expect(GodActionService.foundRebel(city).success).toBe(true);
    expect(GodActionService.restoreFaction(city).success).toBe(true);
    expect(foundRebelByGod).toHaveBeenCalledWith(city);
    expect(restoreFactionByGod).toHaveBeenCalledWith(city);
  });
});
