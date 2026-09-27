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

function makeTeam() {
  const team: any = { name: "燕", shortName: "燕", isDie: false, users: new Set(), blocks: { children: { size: 1 } } };
  team.makeUser = (id: number, name: string) => {
    if ([...team.users].some((user: any) => user.id === id)) return false;
    const user: any = { id, name, role: "NORMAL", logicalUnitId: `unit-${team.users.size + 1}`, destroyUser: vi.fn(() => { team.users.delete(user); return true; }) };
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
