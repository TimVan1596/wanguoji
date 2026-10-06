import { beforeEach, describe, expect, it, vi } from "vitest";

const { gameCore } = vi.hoisted(() => ({ gameCore: { teams: [] as any[], logicalUnitRegistry: {} } }));

vi.mock("../Game/Game", () => ({ default: { Core: gameCore } }));
vi.mock("../Components/Team", () => ({
  default: class TeamMock {
    static GetUserById(id: number) {
      return gameCore.teams.flatMap((team) => [...team.users]).find((user) => user.id === id);
    }
  },
}));
vi.mock("../Live/Danmu", () => ({ default: { Apply: vi.fn() } }));
vi.mock("../Live/LocalDanmaku", () => ({
  getLocalUserId: (name: string) => 1000000000 + [...name].reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) >>> 0), 0) % 1000000000,
  createLocalDanmu: vi.fn(),
}));

import PopulationSystem, { selectNormalUsersForGodRemoval } from "./PopulationSystem";
import worldRandom from "./WorldRandom";
import { MonthlyPhaseProfiler } from "./MonthlyPhaseProfiler";
import { RollingStepPerformance } from "./RollingStepPerformance";

function makeTeam() {
  const team: any = { name: "燕", shortName: "燕", isDie: false, users: new Set(), blocks: { children: { size: 1 } } };
  team.makeUser = (id: number, name: string, _face?: string, loyalty = 50) => {
    if ([...team.users].some((user: any) => user.id === id)) return false;
    const user: any = { id, name, loyalty, role: "NORMAL", logicalUnitId: `unit-${team.users.size + 1}`, destroyUser: vi.fn(() => { team.users.delete(user); return true; }) };
    team.users.add(user);
    return user;
  };
  return team;
}

describe("God population intervention", () => {
  beforeEach(() => {
    gameCore.teams = [];
    vi.stubGlobal("Phaser", { Math: { Between: (min: number) => min } });
  });

  it("uses persisted counters for stable unique identities across export/import", () => {
    const team = makeTeam();
    gameCore.teams = [team];
    const first = new PopulationSystem();
    expect(first.godAdd(team, 2)).toBe(2);
    const persisted = first.exportState();
    const second = new PopulationSystem();
    second.importState(persisted);
    expect(second.godAdd(team, 2)).toBe(2);
    expect([...team.users].map((user: any) => user.name)).toEqual([
      "God-燕-000001", "God-燕-000002", "God-燕-000003", "God-燕-000004",
    ]);
    expect(new Set([...team.users].map((user: any) => user.id)).size).toBe(4);
    expect(new Set([...team.users].map((user: any) => user.logicalUnitId)).size).toBe(4);
  });

  it("removes only NORMAL users in deterministic id/name order and preserves rulers", () => {
    const users = [
      { id: 9, name: "later", role: "NORMAL" },
      { id: 1, name: "ruler", role: "RULER" },
      { id: 3, name: "third", role: "NORMAL" },
      { id: 2, name: "second", role: "NORMAL" },
    ];
    expect(selectNormalUsersForGodRemoval(users, 2).map((user) => user.name)).toEqual(["second", "third"]);
    expect(selectNormalUsersForGodRemoval(users, 20)).toHaveLength(3);
  });
});

describe("seeded canonical population progression", () => {
  function runPopulation(seed: string, months: number, debug = false) {
    worldRandom.initialize(seed);
    const team = makeTeam();
    gameCore.teams = [team];
    const population = new PopulationSystem();
    population.initialize([team], { [team.name]: 4 });
    const profile = debug ? new MonthlyPhaseProfiler() : undefined;
    const timings = new RollingStepPerformance();
    for (let month = 6; month <= months; month += 6) {
      population.update(month, [team], () => 1, profile);
      population.getRuntimeCardinality();
      profile?.flush(timings);
    }
    return { team, population };
  }

  const snapshot = (team: any, population: PopulationSystem) => ({
    users: [...team.users].map((user: any) => ({ id: user.id, name: user.name, loyalty: user.loyalty })),
    populationSystem: population.exportState(),
  });

  it("produces the same population canonical projection for a same-seed fixed-month run and differs for another seed", () => {
    const first = runPopulation("same-world", 720);
    const second = runPopulation("same-world", 720);
    expect(snapshot(first.team, first.population)).toEqual(snapshot(second.team, second.population));
    const other = runPopulation("different-world", 720);
    expect(snapshot(first.team, first.population)).not.toEqual(snapshot(other.team, other.population));
  });

  it("debug profiling on/off preserves same-seed canonical digest and RNG position", () => {
    const plain = runPopulation("debug-lifetime", 1200);
    const rng = worldRandom.exportState();
    const profiled = runPopulation("debug-lifetime", 1200, true);
    expect(snapshot(plain.team, plain.population)).toEqual(snapshot(profiled.team, profiled.population));
    expect(worldRandom.exportState()).toEqual(rng);
  });

  it("matches uninterrupted population progression after saving and restoring RNG plus subsystem state", () => {
    const uninterrupted = runPopulation("save-split-world", 360);
    const boundary = {
      population: uninterrupted.population.exportState(),
      random: worldRandom.exportState(),
      users: snapshot(uninterrupted.team, uninterrupted.population).users,
    };
    for (let month = 366; month <= 720; month += 6) uninterrupted.population.update(month, [uninterrupted.team]);
    const finalUninterrupted = snapshot(uninterrupted.team, uninterrupted.population);

    worldRandom.initialize("temporary-hydration-noise");
    const hydratedTeam = makeTeam();
    gameCore.teams = [hydratedTeam];
    boundary.users.forEach((saved: any) => {
      hydratedTeam.users.add({ ...saved, role: "NORMAL", logicalUnitId: `unit-${saved.id}` });
    });
    const hydratedPopulation = new PopulationSystem();
    hydratedPopulation.importState(boundary.population);
    worldRandom.restore(boundary.random);
    for (let month = 366; month <= 720; month += 6) hydratedPopulation.update(month, [hydratedTeam]);
    expect(snapshot(hydratedTeam, hydratedPopulation)).toEqual(finalUninterrupted);
  });
});
