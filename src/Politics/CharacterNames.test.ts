import { afterEach, describe, expect, it, vi } from "vitest";
import { cultureGivenNamePools, deriveNameCulture, generateMilitaryPersonalName, hanGivenNamePool } from "./NameCulture";
import { MilitaryCommandRegistryStore } from "./MilitaryCommandRegistry";
import { getMilitaryPersonDisplayName } from "./MilitaryPersonIdentity";
import { pickRulerGivenName } from "./SuccessionRules";
import worldRandom, { WorldRandom } from "../Simulation/WorldRandom";

afterEach(() => { vi.restoreAllMocks(); });
const identity = { seed: "names-x", personId: "military-person-1", sourceUserId: 1000000407, bornMonth: -300, originalName: "赵-407", culture: "HAN" as const };

describe("authoritative character names", () => {
  it("generates stable Chinese names without touching random state, source identity or population", () => {
    const before = worldRandom.exportState();
    const names = Array.from({ length: 1000 }, (_, i) => generateMilitaryPersonalName({ ...identity, personId: `military-person-${i}` }));
    expect(names.every(n => /^[\u3400-\u9fff]{2,5}$/.test(n))).toBe(true);
    expect(new Set(names).size).toBeGreaterThan(900);
    expect(names.filter(n => n.startsWith("赵")).length).toBeLessThan(30);
    expect(worldRandom.exportState()).toEqual(before);
    expect(generateMilitaryPersonalName(identity)).toBe(generateMilitaryPersonalName(identity));
  });

  it.each(["耶律氏", "完颜氏", "孛儿只斤氏", "爱新觉罗氏"])("preserves the %s culture's atomic vocabulary", houseName => {
    const culture = deriveNameCulture(houseName);
    if (culture === "HAN") throw new Error("expected non-HAN culture");
    const name = generateMilitaryPersonalName({ ...identity, culture });
    expect(cultureGivenNamePools[culture].atomicNames.some(given => name.endsWith(given))).toBe(true);
    expect(name).not.toContain("赵-");
  });

  it("binds once to the original User and survives transfer, reappointment, death and JSON import", () => {
    const registry = new MilitaryCommandRegistryStore(), events: any[] = [];
    registry.setEventWriter(e => { events.push(e); return e.id; });
    const qin: any = { name: "赵", houseName: "赵氏", status: "ACTIVE", users: new Set() };
    const wei: any = { name: "黄", houseName: "耶律氏", status: "ACTIVE", users: new Set() };
    const user: any = { id: identity.sourceUserId, name: identity.originalName, bornMonth: -300, team: qin, role: "NORMAL", player: { active: true, logicalUnitId: "u1" } };
    const member = (id: number, team: any) => ({ ...user, id: identity.sourceUserId + id, name: `居民${id}`, team, player: { active: true, logicalUnitId: `u${id}` } });
    qin.users.add(user); qin.users.add(member(2, qin)); wei.users.add(member(3, wei));
    const draw = vi.spyOn(worldRandom, "next").mockReturnValue(0);
    registry.update(12, [qin], []);
    expect(draw).toHaveBeenCalledTimes(2);
    const person = registry.getPeople()[0], personalName = person.personalName;
    expect(person).toMatchObject({ sourceUserId: user.id, name: user.name, bornMonth: user.bornMonth });
    expect(user.militaryPersonId).toBe(person.personId);
    expect(qin.users.size).toBe(2);
    registry.onUserTransfer(user, wei.name, 13);
    qin.users.delete(user); wei.users.add(user); user.team = wei;
    registry.update(24, [wei], []);
    expect(person.appointments.map(a => a.factionId)).toEqual(["赵", "黄"]);
    expect(registry.getPeople()).toHaveLength(1);
    expect(person.personalName).toBe(personalName);
    registry.onUserDestroyed(user, 25, "BATTLE_DEATH");
    const restored = new MilitaryCommandRegistryStore(); restored.importState(JSON.parse(JSON.stringify(registry.exportState())));
    expect(getMilitaryPersonDisplayName(restored.getPeople()[0])).toBe(personalName);
    expect(events.filter(e => ["military-appointment", "military-person-died"].includes(e.type)).every(e => e.title.includes(personalName))).toBe(true);
    expect(user.name).toBe("赵-407"); expect(user.id).toBe(identity.sourceUserId);
  });

  it("has unique vocabulary and diverse recent generations with exactly two existing HAN draws", () => {
    for (const pool of [hanGivenNamePool.singleNames, hanGivenNamePool.doubleNamePrefixes, hanGivenNamePool.doubleNameSuffixes])
      expect(new Set(pool).size).toBe(pool.length);
    expect(hanGivenNamePool.singleNames.length).toBeGreaterThan(100);
    for (const seed of ["house-a", "house-b", "house-c", "house-d"]) {
      const random = new WorldRandom(); random.initialize(seed);
      const names: string[] = [];
      for (let generation = 0; generation < 100; generation++) {
        const before = random.exportState().position;
        const name = pickRulerGivenName(hanGivenNamePool, names.slice(-12), max => random.pickIndex(max));
        expect(names.slice(-12)).not.toContain(name);
        expect(random.exportState().position - before).toBe(2);
        names.push(name);
      }
      const doubles = names.filter(n => n.length === 2).length;
      expect(doubles).toBeGreaterThan(35); expect(doubles).toBeLessThan(75);
      expect(new Set(names).size).toBeGreaterThan(80);
    }
  });

  it("two namesakes keep distinct people and original User IDs", () => {
    const registry = new MilitaryCommandRegistryStore();
    const teams: any[] = ["赵", "黄"].map((name, i) => {
      const team: any = { name, status: "ACTIVE", users: new Set() };
      for (let j = 0; j < 2; j++) team.users.add({ id: 10 * i + j + 1, name: j ? "成员" : "张清", bornMonth: -300,
        role: "NORMAL", team, player: { active: true, logicalUnitId: `u-${i}-${j}` } });
      return team;
    });
    vi.spyOn(worldRandom, "next").mockReturnValue(0);
    registry.update(12, teams, []);
    const people = registry.getPeople();
    expect(people.map(p => p.personalName)).toEqual(["张清", "张清"]);
    expect(new Set(people.map(p => p.personId)).size).toBe(2);
    expect(people.map(p => p.sourceUserId)).toEqual([1, 11]);
    expect(teams.map(t => t.users.size)).toEqual([2, 2]);
  });
});
