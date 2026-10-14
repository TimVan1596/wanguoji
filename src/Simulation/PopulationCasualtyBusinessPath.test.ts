import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { PopulationTransitionAudit } from "./PopulationTransitionAudit";
import worldRandom from "./WorldRandom";

const { core } = vi.hoisted(() => ({ core: {} as any }));
vi.mock("../Game/Game", () => ({ default: { Core: core, BlockSize: 32 } }));
vi.mock("../Components/Farms", () => ({ default: class { init() {} setDie() {} } }));
vi.mock("../Components/Player", () => ({ default: class {} }));
vi.mock("../Components/Slaves", () => ({ default: class { dispose() {} children = { each() {} }; } }));
vi.mock("../store", () => ({ store: { getState: () => ({ root: {} }), dispatch: vi.fn() } }));
vi.mock("../History/WorldHistory", () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("../Politics/Dynasty", () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("../Simulation/ArchivedCities", () => ({ default: { archive: vi.fn() } }));

let Team: typeof import("../Components/Team").default;
let User: typeof import("../Components/User").default;
let City: typeof import("../Components/City").default;
let Block: typeof import("../Components/Block").default;
let MilitaryCommandRegistry: typeof import("../Politics/MilitaryCommandRegistry").default;
let FactionEffects: typeof import("./FactionEffects").default;
let Diplomacy: typeof import("../Politics/Diplomacy").default;
let orderCasualtyCandidates: typeof import("./PopulationCasualtySelection").orderCasualtyCandidates;

beforeAll(async () => {
  class PhaserRectangle {}
  class PhaserGroup {}
  vi.stubGlobal("Phaser", {
    GameObjects: { Rectangle: PhaserRectangle, Group: PhaserGroup },
    Math: { Clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)) },
    Display: { Align: { In: { Center() {} } } },
  });
  ({ default: Team } = await import("../Components/Team"));
  ({ default: User } = await import("../Components/User"));
  ({ default: City } = await import("../Components/City"));
  ({ default: Block } = await import("../Components/Block"));
  ({ default: MilitaryCommandRegistry } = await import("../Politics/MilitaryCommandRegistry"));
  ({ default: FactionEffects } = await import("./FactionEffects"));
  ({ default: Diplomacy } = await import("../Politics/Diplomacy"));
  ({ orderCasualtyCandidates } = await import("./PopulationCasualtySelection"));
});

afterEach(() => {
  vi.restoreAllMocks();
  MilitaryCommandRegistry.reset();
  FactionEffects.reset();
  Diplomacy.reset();
});
afterAll(() => vi.unstubAllGlobals());

function setup() {
  const audit = new PopulationTransitionAudit();
  const defender = Object.create(Team.prototype) as InstanceType<typeof Team>;
  Object.assign(defender, { name: "defender", displayName: "守方", users: new Set(), rulerUser: undefined, status: "ACTIVE" });
  const attacker = Object.create(Team.prototype) as InstanceType<typeof Team>;
  Object.assign(attacker, { name: "attacker", displayName: "攻方", users: new Set(), status: "ACTIVE" });
  const logicalEntries = new Map<string, any>();
  const populationMutations: any[] = [];
  const removedUsers: number[] = [];
  const events: any[] = [];
  audit.reset(0, [defender, attacker]);
  core.logicalGameplayAuthority = true;
  core.teams = [defender, attacker];
  core.simulator = {
    year: 12,
    recordPopulationMutation(team: any, before: number, after: number, metadata: any) {
      populationMutations.push(metadata);
      audit.record(team, before, after, metadata);
    },
    getPopulationTransitionDiagnostics: () => audit.getRecentSignificant(),
  };
  core.logicalUnitRegistry = {
    getEntry: (unitId: string) => logicalEntries.get(unitId),
    unregisterUser(user: any) { removedUsers.push(user.id); logicalEntries.delete(user.player.logicalUnitId); },
  };
  core.recordUserDeathForDiagnostics = vi.fn();
  core.handleRulerCombatDeath = vi.fn(() => false);
  MilitaryCommandRegistry.setEventWriter(event => { events.push(event); return event.id; });
  const users: InstanceType<typeof User>[] = [];
  for (let index = 1; index <= 6; index += 1) {
    const unitId = `unit-${index}`;
    const player: any = { logicalUnitId: unitId, x: index * 32, y: 64, active: true, role: "NORMAL",
      destroyPlayerTree: vi.fn(), tp: vi.fn() };
    const user = new User(index, `守民${index}`, defender, player, undefined, 70, "NORMAL", undefined,
      { deferRuntime: true, bornMonth: -300 - index });
    player.user = user;
    defender.users.add(user);
    users.push(user);
    logicalEntries.set(unitId, { state: { unitId, factionId: "defender", logicalX: index * 32, logicalY: 64,
      currentGridX: index, currentGridY: 2, userId: index, alive: true }, player });
  }
  return { audit, defender, attacker, users, logicalEntries, populationMutations, removedUsers, events };
}

describe("production casualty business path", () => {
  it("runs City siege through Team, real User destruction, military lifecycle and session audit", () => {
    const { audit, defender, attacker, users, removedUsers, events } = setup();
    const personId = "military-person-1";
    users[0].militaryPersonId = personId;
    const candidates = users.map(user => ({ user, identity: {
      userId: user.id, name: user.name, bornMonth: user.bornMonth,
      logicalUnitId: user.player.logicalUnitId, militaryPersonId: user.militaryPersonId,
    } }));
    const context = Array.from({ length: 100 }, (_, index) => ({ factionId: "defender", worldMonth: 12,
      damageSource: "CITY_SIEGE", triggerCityId: `siege-city-${index}` }))
      .find(candidateContext => orderCasualtyCandidates(candidates, candidateContext)?.[0].user === users[0]);
    expect(context).toBeDefined();
    const victim = users[0];
    const remainingUnits = users.filter(user => user !== victim).slice(0, 1).map(user => user.player.logicalUnitId!);
    MilitaryCommandRegistry.importState({
      people: [{ personId, sourceUserId: victim.id, name: victim.name, bornMonth: victim.bornMonth, factionId: defender.name,
        status: "ACTIVE", appointments: [{ factionId: defender.name, startMonth: 0, commandId: "military-command-1" }], capturedEventIds: [] }],
      formations: [{ commandId: "military-command-1", factionId: defender.name, commanderPersonId: personId,
        memberUnitIds: [victim.player.logicalUnitId!, ...remainingUnits], createdMonth: 0, status: "ACTIVE", captures: [] }],
      personSequence: 2, commandSequence: 2, lastEvaluationMonth: 0,
    });
    const city: any = Object.assign(Object.create(City.prototype), {
      id: context!.triggerCityId, name: "北城", ownerFactionId: defender.name, defense: 20, maxDefense: 20,
      block: { x: 1024, y: 1024, updateCityDisplay: vi.fn() }, siegeDamageRemainder: 0, lastSiegeDamageYear: -1,
      lastSiegeDevastationYear: 12, devastation: 0, lastCapturedYear: undefined,
      siegeContacts: new Map([[attacker.name, { team: attacker, count: 3, year: 12 }]]),
    });
    vi.spyOn(city, "refreshZoneVisual").mockImplementation(() => {});
    vi.spyOn(Diplomacy, "canAttack").mockReturnValue(true);
    vi.spyOn(FactionEffects, "getSiegeMultiplier").mockReturnValue(1);
    const rngBefore = worldRandom.exportState();

    (city as any).updateSiege(12);

    expect(city.defense).toBe(19);
    expect(defender.users.size).toBe(5);
    expect(defender.users.has(victim)).toBe(false);
    expect(removedUsers).toEqual([victim.id]);
    expect(MilitaryCommandRegistry.getPeople()[0]).toMatchObject({ status: "DEAD", deathMonth: 12, deathCause: "SIEGE_LOSS" });
    expect(MilitaryCommandRegistry.getFormations()[0]).toMatchObject({ status: "DISBANDED" });
    expect(events.filter(event => event.type === "military-person-died")).toHaveLength(1);
    expect(audit.getRecentSignificant()).toMatchObject([{
      cause: "SIEGE_LOSS", factionId: "defender", damageSource: "CITY_SIEGE", triggerCityId: context!.triggerCityId,
      before: 6, after: 5, delta: -1,
      casualty: { victimUserId: victim.id, victimLogicalUnitId: victim.player.logicalUnitId,
        victimMilitaryPersonId: personId, victimPosition: { x: victim.id * 32, y: 64, source: "LOGICAL" },
        populationBefore: 6, populationAfter: 5, destroyed: true },
    }]);
    expect(audit.getRecentSignificant()[0].casualty?.victimPosition?.x).not.toBe(city.block.x);
    expect(rngBefore).toEqual(worldRandom.exportState());
  });

  it("applies the same identity selection to Block home occupation without inventing a city", () => {
    const { audit, defender, attacker, users } = setup();
    const block: any = Object.create(Block.prototype);
    Object.assign(block, { city: undefined, isHome: true, hp: 10, team: defender });
    vi.spyOn(Diplomacy, "canAttack").mockReturnValue(true);
    const rngBefore = worldRandom.exportState();

    block.setTeam(attacker);

    expect(block.hp).toBe(9);
    expect(defender.users.size).toBe(5);
    const row = audit.getRecentSignificant()[0];
    expect(row).toMatchObject({ cause: "SIEGE_LOSS", damageSource: "HOSTILE_HOME_OCCUPATION", delta: -1,
      casualty: { destroyed: true, populationBefore: 6, populationAfter: 5 } });
    expect(row.triggerCityId).toBeUndefined();
    expect(row.casualty?.victimUserId).toBeDefined();
    expect(users.some(user => user.id === row.casualty?.victimUserId)).toBe(true);
    expect(rngBefore).toEqual(worldRandom.exportState());
  });

  it("preserves the ruler death gate and calls it at most once when the ruler candidate is protected", () => {
    const { defender, users } = setup();
    const ruler = users[0];
    ruler.role = "RULER";
    ruler.player.role = "RULER";
    const candidates = users.map(user => ({ user, identity: {
      userId: user.id, name: user.name, bornMonth: user.bornMonth,
      logicalUnitId: user.player.logicalUnitId, militaryPersonId: user.militaryPersonId,
    } }));
    const context = Array.from({ length: 100 }, (_, index) => ({ factionId: "defender", worldMonth: 12,
      damageSource: "CITY_SIEGE", triggerCityId: `ruler-city-${index}` }))
      .find(candidateContext => orderCasualtyCandidates(candidates, candidateContext)?.[0].user === ruler);
    expect(context).toBeDefined();
    const rngBefore = worldRandom.exportState();

    const removed = defender.removeOneUser("SIEGE_LOSS", { ...context!, damageSource: "CITY_SIEGE" });

    expect(core.handleRulerCombatDeath).toHaveBeenCalledTimes(1);
    expect(defender.users.has(ruler)).toBe(true);
    expect(ruler.isDestroyed).toBe(false);
    expect(ruler.player.tp).toHaveBeenCalledOnce();
    expect(removed).toBeDefined();
    expect(removed).not.toBe(ruler);
    expect(rngBefore).toEqual(worldRandom.exportState());
  });

  it("makes repeated destruction idempotent without repeating death, population or unit cleanup", () => {
    const { defender, users, removedUsers, events, audit } = setup();
    const victim = users[0];
    const before = defender.users.size;
    expect(victim.destroyUser(false, { cause: "SIEGE_LOSS", month: 12, damageSource: "CITY_SIEGE", triggerCityId: "city-a" })).toBe(true);
    expect(victim.destroyUser(false, { cause: "SIEGE_LOSS", month: 12, damageSource: "CITY_SIEGE", triggerCityId: "city-a" })).toBe(false);
    expect(defender.users.size).toBe(before - 1);
    expect(removedUsers).toEqual([victim.id]);
    expect(events.filter(event => event.type === "military-person-died")).toHaveLength(0);
    expect(audit.getRecentSignificant()).toHaveLength(1);
  });
});
