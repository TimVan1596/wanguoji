import {composeMilitaryBiography} from "../Politics/PersonBiography";
import { afterAll, beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { PopulationTransitionAudit } from "./PopulationTransitionAudit";
import worldRandom from "./WorldRandom";
import { deriveMilitaryLifeSchedule } from "../Politics/MilitaryLifeRules";
import { describeMilitaryStatus, describeMilitaryDeathCause, describeMilitaryAppointmentEnd } from "../UI/Components/FactionDetails/MilitaryPeoplePresentation";

const { core } = vi.hoisted(() => ({ core: {} as any }));
vi.mock("../Game/Game", () => ({ default: { Core: core, BlockSize: 32 } }));
vi.mock("../Components/Farms", () => ({ default: class { init() {} setDie() {} } }));
vi.mock("../Components/Player", () => ({ default: class {} }));
vi.mock("../Components/Slaves", () => ({ default: class { dispose() {} children = { each() {} }; } }));
vi.mock("../store", () => ({ store: { getState: () => ({ root: {} }), dispatch: vi.fn() } }));
vi.mock("../History/WorldHistory", () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("../Politics/Dynasty", () => ({ default: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("../Simulation/ArchivedCities", () => ({ default: { archive: vi.fn() } }));

let LogicalUnitRegistry: typeof import("./LogicalUnitRegistry").default;
let HistoryStore: typeof import("../History/WorldHistory").WorldHistoryStore;
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
  ({ default: LogicalUnitRegistry } = await import("./LogicalUnitRegistry"));
  ({ WorldHistoryStore: HistoryStore } = await vi.importActual<typeof import("../History/WorldHistory")>("../History/WorldHistory"));
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
afterAll(() => { vi.unstubAllGlobals(); });

function setup(born: (index: number) => number = index => -300 - index) {
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
  MilitaryCommandRegistry.setEventWriter(event => { events.push(event); return event.id; }, factionId => events.filter(e => e.factionIds?.includes(factionId)));
  const users: InstanceType<typeof User>[] = [];
  for (let index = 1; index <= 6; index += 1) {
    const unitId = `unit-${index}`;
    const player: any = { logicalUnitId: unitId, x: index * 32, y: 64, active: true, role: "NORMAL", team: defender,
      destroyPlayerTree: vi.fn(), tp: vi.fn() };
    const user = new User(index, `守民${index}`, defender, player, undefined, 70, "NORMAL", undefined,
      { deferRuntime: true, bornMonth: born(index) });
    player.user = user;
    defender.users.add(user);
    users.push(user);
    logicalEntries.set(unitId, { state: { unitId, factionId: "defender", logicalX: index * 32, logicalY: 64,
      currentGridX: index, currentGridY: 2, userId: index, role: "NORMAL", alive: true }, player });
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
      people: [{ personId, sourceUserId: victim.id, personalName: "李承远", name: victim.name, bornMonth: victim.bornMonth, factionId: defender.name,
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
    const person=MilitaryCommandRegistry.getPeople()[0];
    const biography=composeMilitaryBiography(person,MilitaryCommandRegistry.getChronicle(person,12),"defender");
    expect(biography.ending).toContain("战乱中去世");
    expect(biography.ending).not.toMatch(/死守|守城|城下|战伤/);
    expect(events.find(e=>e.type==="military-person-died").metadata.deathCause).toBe("SIEGE_LOSS");

    expect(victim.destroyUser(false, { cause: "SIEGE_LOSS", month: 12, damageSource: "CITY_SIEGE", triggerCityId: context!.triggerCityId })).toBe(false);
    expect(defender.users.size).toBe(5);
    expect(MilitaryCommandRegistry.getPeople()[0]).toMatchObject({ status: "DEAD", deathMonth: 12, deathCause: "SIEGE_LOSS" });
    expect(events.filter(event => event.type === "military-person-died")).toHaveLength(1);
    expect(audit.getRecentSignificant()).toHaveLength(1);
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


function militaryLifeFixture(born: (index: number) => number = i => i === 1 ? -480 : -300) {
  const fixture = setup(born);
  const registry = new LogicalUnitRegistry();
  registry.importState(7, fixture.users.map(user => ({ state: fixture.logicalEntries.get(user.player.logicalUnitId!)!.state, player: user.player, user })));
  core.logicalUnitRegistry = registry;
  const history = new HistoryStore();
  MilitaryCommandRegistry.setEventWriter(event => history.addEvent(event), factionId => history.getEventsForFaction(factionId));
  vi.spyOn(worldRandom, "next").mockReturnValue(0);
  MilitaryCommandRegistry.update(0, [fixture.defender, fixture.attacker], []);
  const person = MilitaryCommandRegistry.getPeople()[0];
  expect(person.sourceUserId).toBe(fixture.users[0].id);
  vi.mocked(worldRandom.next).mockReturnValue(1);
  return { ...fixture, registry, history, person, life: deriveMilitaryLifeSchedule(person) };
}
const annualAt = (month: number) => Math.ceil(month / 12) * 12;

describe("real military User retirement, mortality and succession", () => {
  it("keeps a 64-year-old live commander, then retires at the personal boundary without population loss", () => {
    const f = militaryLifeFixture(i => i === 1 ? -64 * 12 : -300);
    expect(f.person.status).toBe("ACTIVE");
    const month = annualAt(f.life.retirementMonth);
    MilitaryCommandRegistry.update(month, [f.defender, f.attacker], []);
    expect(f.person.status).toBe("RETIRED");
    expect(f.person.appointments[0]).toMatchObject({ endMonth: month, endReason: "AGE_RETIREMENT" });
    expect(f.defender.users.size).toBe(6); expect(f.users.every(user => !user.isDestroyed)).toBe(true);
    expect(MilitaryCommandRegistry.getFormations()[0]).toMatchObject({ status: "DISBANDED", targetCityId: undefined });
    expect(f.history.getEvents().filter(e => e.type === "military-command-ended")).toHaveLength(1);
    expect(describeMilitaryStatus(f.person)).toBe("已退役（年老）");
    expect(describeMilitaryAppointmentEnd(f.person.appointments[0].endReason)).toBe("年老退役");
    vi.mocked(worldRandom.next).mockReturnValue(0);
    MilitaryCommandRegistry.update(month + 12, [f.defender, f.attacker], []);
    expect(f.person.appointments).toHaveLength(1);
    expect(MilitaryCommandRegistry.getPeople().some(p => p.personId !== f.person.personId && p.status === "ACTIVE")).toBe(true);
    expect(MilitaryCommandRegistry.getDiagnostics().ageBlocked).toBeGreaterThan(0);
  });
  it("runs annual natural death through real User, Team, logical registry, population audit, history and presentation once", () => {
    const f = militaryLifeFixture();
    const month = annualAt(f.life.naturalDeathMonth), victim = f.users[0], unitId = victim.player.logicalUnitId!;
    MilitaryCommandRegistry.update(month, [f.defender, f.attacker], []);
    MilitaryCommandRegistry.update(month, [f.defender, f.attacker], []);
    expect(victim.isDestroyed).toBe(true); expect(f.defender.users.size).toBe(5);
    expect(f.registry.getEntry(unitId)).toBeUndefined(); expect(victim.player.destroyPlayerTree).toHaveBeenCalledTimes(1);
    expect(victim.slaveGroup.dispose).toBeDefined();
    expect(f.person).toMatchObject({ status: "DEAD", deathMonth: month, deathCause: "NATURAL_DEATH" });
    expect(f.person.appointments[0]).toMatchObject({ endMonth: month, endReason: "DEATH" });
    expect(f.history.getEvents().filter(e => e.type === "military-person-died")).toHaveLength(1);
    expect(f.audit.getRecentSignificant().find(r => r.cause === "NATURAL_DEATH")).toMatchObject({ before: 6, after: 5, delta: -1,
      damageSource: "MILITARY_LIFESPAN", casualty: { victimUserId: victim.id, victimMilitaryPersonId: f.person.personId } });
    expect(describeMilitaryStatus(f.person)).toBe("已故"); expect(describeMilitaryDeathCause(f.person.deathCause)).toBe("自然去世（NATURAL_DEATH）");
    expect(MilitaryCommandRegistry.getDiagnostics()).toMatchObject({ naturalDeaths: 1, deaths: 1 });
    expect(f.users.slice(1).every(user => !user.isDestroyed)).toBe(true);
  });
  it("lets a retired person die later and never restores an over-age military appointment", () => {
    const f = militaryLifeFixture();
    const retirement = annualAt(f.life.retirementMonth), death = annualAt(f.life.naturalDeathMonth);
    MilitaryCommandRegistry.update(retirement, [f.defender, f.attacker], []);
    expect(f.person.status).toBe("RETIRED"); expect(f.person.deathMonth).toBeUndefined();
    MilitaryCommandRegistry.update(death, [f.defender, f.attacker], []);
    expect(f.person).toMatchObject({ status: "DEAD", deathCause: "NATURAL_DEATH" });
    expect(f.person.appointments[0].endReason).toBe("AGE_RETIREMENT");
    expect(f.person.appointments).toHaveLength(1);
  });
  it.each(["missing", "reused-id", "wrong-birth", "invalid-unit"])("does not fabricate death when original User verification fails: %s", kind => {
    const f = militaryLifeFixture(), victim = f.users[0];
    if (kind === "missing") f.defender.users.delete(victim);
    if (kind === "reused-id") victim.militaryPersonId = undefined;
    if (kind === "wrong-birth") f.person.bornMonth--;
    if (kind === "invalid-unit") f.registry.unregisterUser(victim);
    const before = f.defender.users.size;
    MilitaryCommandRegistry.update(annualAt(deriveMilitaryLifeSchedule(f.person).naturalDeathMonth) + 12, [f.defender, f.attacker], []);
    expect(f.person.status).not.toBe("DEAD"); expect(f.person.deathMonth).toBeUndefined();
    expect(f.defender.users.size).toBe(before);
    expect(f.history.getEvents().some(e => e.type === "military-person-died")).toBe(false);
    expect(MilitaryCommandRegistry.getDiagnostics().identityFailures).toBeGreaterThan(0);
  });
  it("does not double archive a preceding combat death or turn teardown into natural death", () => {
    const f = militaryLifeFixture();
    f.users[0].destroyUser(false, { cause: "SIEGE_LOSS", month: 12, damageSource: "CITY_SIEGE" });
    MilitaryCommandRegistry.update(annualAt(f.life.naturalDeathMonth), [f.defender, f.attacker], []);
    expect(f.person).toMatchObject({ deathMonth: 12, deathCause: "SIEGE_LOSS" });
    expect(MilitaryCommandRegistry.getDiagnostics().naturalDeaths).toBe(0);
    expect(f.history.getEvents().filter(e => e.type === "military-person-died")).toHaveLength(1);
  });
  it("does not accept a natural-death request before the actual lifespan or for ordinary population", () => {
    const f = militaryLifeFixture();
    expect(f.users[0].destroyUser(false, { cause: "NATURAL_DEATH", month: 12 })).toBe(false);
    expect(f.users[1].destroyUser(false, { cause: "NATURAL_DEATH", month: 1200 })).toBe(false);
    expect(f.defender.users.size).toBe(6); expect(f.person.status).toBe("ACTIVE");
    expect(f.history.getEvents().filter(e => e.type === "military-person-died")).toHaveLength(0);
  });
  it("releases both capped formations as their real commanders age without deleting ordinary members", () => {
    const f = militaryLifeFixture(() => -480);
    vi.mocked(worldRandom.next).mockReturnValue(0);
    // Release normal soldiers from the first twelve-slot formation to form a second real command.
    MilitaryCommandRegistry.getFormations()[0].memberUnitIds = f.users.slice(0, 2).map(u => u.player.logicalUnitId!);
    MilitaryCommandRegistry.update(12, [f.defender, f.attacker], []);
    expect(MilitaryCommandRegistry.getPeople().filter(p => p.status === "ACTIVE")).toHaveLength(2);
    const month = annualAt(Math.max(...MilitaryCommandRegistry.getPeople().map(p => deriveMilitaryLifeSchedule(p).retirementMonth)));
    vi.mocked(worldRandom.next).mockReturnValue(1);
    MilitaryCommandRegistry.update(month, [f.defender, f.attacker], []);
    expect(MilitaryCommandRegistry.getFormations().filter(g => g.status === "ACTIVE")).toHaveLength(0);
    expect(MilitaryCommandRegistry.getDiagnostics().releasedFormations).toBe(2);
    expect(f.users.slice(4).every(u => !u.isDestroyed)).toBe(true);
  });
  it("keeps legal younger reappointments and records separate real appointment intervals", () => {
    const f = militaryLifeFixture();
    MilitaryCommandRegistry.reconcileFactionEnd(f.defender.name, 1);
    expect(f.person.status).toBe("RETIRED");
    vi.mocked(worldRandom.next).mockReturnValue(0);
    MilitaryCommandRegistry.update(12, [f.defender, f.attacker], []);
    expect(f.person.status).toBe("ACTIVE"); expect(f.person.appointments).toHaveLength(2);
    expect(f.person.appointments[0].endMonth).toBe(1); expect(f.person.appointments[1].startMonth).toBe(12);
    expect(MilitaryCommandRegistry.getDiagnostics().reappointments).toBe(1);
  });
  it("imports an old over-age V15 record without death or draw, then processes it at the next annual boundary", () => {
    const f = militaryLifeFixture();
    const saved = MilitaryCommandRegistry.exportState(); saved.lastEvaluationMonth = annualAt(f.life.naturalDeathMonth);
    MilitaryCommandRegistry.importState(saved);
    const random = worldRandom.exportState();
    expect(MilitaryCommandRegistry.exportState()).toEqual(saved); expect(f.defender.users.size).toBe(6);
    const month = saved.lastEvaluationMonth + 1;
    MilitaryCommandRegistry.update(month, [f.defender, f.attacker], []);
    expect(f.defender.users.size).toBe(6);
    MilitaryCommandRegistry.update(annualAt(month), [f.defender, f.attacker], []);
    expect(f.defender.users.size).toBe(5); expect(MilitaryCommandRegistry.getPeople()[0].deathCause).toBe("NATURAL_DEATH");
    expect(worldRandom.exportState()).toEqual(random);
  });
  it("survives centuries of annual checks without immortal verified commanders or repeated death history", () => {
    const f = militaryLifeFixture();
    for (let month = 12; month <= 3600; month += 12) MilitaryCommandRegistry.update(month, [f.defender, f.attacker], []);
    expect(f.person.status).toBe("DEAD");
    expect(f.history.getEvents().filter(e => e.type === "military-person-died")).toHaveLength(1);
    expect(f.history.getEvents().length).toBeLessThan(10);
    expect(MilitaryCommandRegistry.getFormations().filter(f => f.status === "ACTIVE")).toHaveLength(0);
  });
});
