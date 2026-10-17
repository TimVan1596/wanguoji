import { afterEach, describe, expect, it, vi } from "vitest";
import MilitaryCommandRegistry, { deriveUserBornMonth, MilitaryCommandRegistryStore } from "./MilitaryCommandRegistry";
import worldRandom from "../Simulation/WorldRandom";
import { stepLogicalMovement } from "../Simulation/LogicalMovementSystem";
import { applyLogicalOccupation } from "../Simulation/LogicalOccupationSystem";
import Diplomacy from "./Diplomacy";

afterEach(() => { vi.restoreAllMocks(); MilitaryCommandRegistry.reset(); });

function user(id: number, faction: any, unitId: string, bornMonth = -300) {
  return { id, name: `人口${id}`, team: faction, role: "NORMAL", bornMonth,
    militaryPersonId: undefined, player: { active: true, logicalUnitId: unitId, x: id * 10, y: 0 } } as any;
}

describe("persistent military command registry", () => {
  it("derives adult birth months without consuming the world random stream", () => {
    const before = worldRandom.exportState();
    const born = deriveUserBornMonth(7, "甲", "qin", 120);
    expect(born).toBeLessThan(120 - 18 * 12);
    expect(deriveUserBornMonth(7, "甲", "qin", 120)).toBe(born);
    expect(worldRandom.exportState()).toEqual(before);
  });

  it("appoints an existing User, assigns only existing units and issues an executable hostile-city order", () => {
    const draw = vi.spyOn(worldRandom, "next").mockReturnValue(0);
    const registry = MilitaryCommandRegistry;
    const events: any[] = [];
    registry.setEventWriter(event => { events.push(event); return event.id; });
    const qin: any = { name: "qin", status: "ACTIVE", users: new Set(), cities: [] };
    const wei: any = { name: "wei", status: "ACTIVE", users: new Set(), cities: [] };
    const commander = user(1, qin, "unit-1");
    const member = user(2, qin, "unit-2");
    qin.users.add(commander); qin.users.add(member);
    const registerSiegeContact = vi.fn();
    const farCity: any = { id: "a-wei-city", ownerFactionId: "wei", ownerTeam: wei, block: { x: 512, y: 0 }, registerSiegeContact };
    const city: any = { id: "z-wei-capital", ownerFactionId: "wei", ownerTeam: wei, block: { x: 32, y: 0 }, registerSiegeContact };

    registry.update(12, [qin, wei], [farCity, city]);
    draw.mockRestore();

    const [person] = registry.getPeople();
    const [formation] = registry.getFormations();
    expect(person).toMatchObject({ sourceUserId: 1, name: "人口1", bornMonth: -300, status: "ACTIVE" });
    expect(commander.militaryPersonId).toBe(person.personId);
    expect(formation).toMatchObject({ factionId: "qin", commanderPersonId: person.personId, memberUnitIds: ["unit-1", "unit-2"], targetCityId: "z-wei-capital" });
    expect(events.filter(event => event.type === "military-appointment")).toHaveLength(1);
    expect(events.filter(event => event.type === "military-order-issued")).toHaveLength(1);
    expect(events.find(event => event.type === "military-order-issued").metadata.meritInfluenced).toBe(0);
    expect(registry.getDiagnostics()).toMatchObject({ candidates: 2, eligible: 2, appointments: 1, activeCommanders: 1, activeFormations: 1, orders: 1 });

    const units: any[] = ["unit-1", "unit-2"].map(unitId => ({ unitId, factionId: "qin", logicalX: 0,
      logicalY: 0, logicalVX: 0, logicalVY: 0, alive: true, currentGridX: 0, currentGridY: 0, radius: 1, speed: 32, role: "NORMAL" }));
    registry.steerLogicalUnits(12, units, [farCity, city]);
    expect(units.every(unit => unit.logicalVX === 32 && unit.logicalVY === 0)).toBe(true);
    const moved = stepLogicalMovement({ units, deltaMs: 1000, blockSize: 32, bounds: { minX: 0, minY: 0, maxX: 64, maxY: 32 } });
    expect(moved.every(result => result.enteredNewGrid && result.currentGridX === 1)).toBe(true);
    const uncommanded: any = { unitId: "unit-ordinary", factionId: "qin", logicalX: 0, logicalY: 0,
      logicalVX: 0, logicalVY: 0, alive: true, currentGridX: 0, currentGridY: 0, radius: 1, speed: 32, role: "NORMAL" };
    const ordinaryMove = stepLogicalMovement({ units: [uncommanded], deltaMs: 1000, blockSize: 32, bounds: { minX: 0, minY: 0, maxX: 64, maxY: 32 } });
    expect(ordinaryMove[0].enteredNewGrid).toBe(false);
    Diplomacy.reset();
    const contactResult = applyLogicalOccupation({ units, movementResults: moved,
      context: { getTeam: factionId => factionId === "qin" ? qin : wei,
        getBlock: gridX => gridX === 1 ? { city, team: wei } as any : { team: qin } as any, getWorldMonth: () => 12 } });
    expect(contactResult.siegeContacts).toBe(2);
    expect(registerSiegeContact).toHaveBeenCalledTimes(2);
    expect(registerSiegeContact).toHaveBeenCalledWith(qin, 12, undefined, formation.commandId, person.personId);
    registry.recordCommandSiegeContact(formation.commandId, person.personId, farCity.id);
    registry.recordCommandSiegeContact(formation.commandId, person.personId, city.id);
    expect(registry.getDiagnostics()).toMatchObject({ targetCityArrivals: 1, commandedSiegeContacts: 2 });
    city.ownerFactionId = "qin";
    registry.update(13, [qin, wei], [farCity, city]);
    expect(registry.getFormations()[0].targetCityId).toBe(farCity.id);
    expect(registry.getDiagnostics()).toMatchObject({ invalidatedTargets: 1, orders: 2 });
  });

  it("retires the command on faction transfer without recording a death", () => {
    vi.spyOn(worldRandom, "next").mockReturnValue(0);
    const registry = new MilitaryCommandRegistryStore();
    const qin: any = { name: "qin", status: "ACTIVE", users: new Set(), cities: [] };
    const wei: any = { name: "wei", status: "ACTIVE", users: new Set(), cities: [] };
    const commander = user(1, qin, "unit-1"); qin.users.add(commander); qin.users.add(user(2, qin, "unit-2"));
    registry.update(12, [qin, wei], [{ id: "city", ownerFactionId: "wei", ownerTeam: wei, block: { x: 1, y: 1 } } as any]);
    registry.onUserTransfer(commander, "wei", 20);
    expect(registry.getPeople()[0]).toMatchObject({ factionId: "wei", status: "RETIRED" });
    expect(registry.getPeople()[0]).not.toHaveProperty("deathMonth");
    expect(registry.getFormations()[0]).toMatchObject({ status: "DISBANDED" });
  });

  it("removes an ordinary member before that member transfers or dies", () => {
    vi.spyOn(worldRandom, "next").mockReturnValue(0);
    const registry = new MilitaryCommandRegistryStore();
    const qin: any = { name: "qin", status: "ACTIVE", users: new Set(), cities: [] };
    const wei: any = { name: "wei", status: "ACTIVE", users: new Set(), cities: [] };
    const commander = user(1, qin, "unit-1");
    const member = user(2, qin, "unit-2");
    qin.users.add(commander); qin.users.add(member);
    registry.update(12, [qin, wei], [{ id: "city", ownerFactionId: "wei", ownerTeam: wei, block: { x: 1, y: 1 } } as any]);
    registry.onUserTransfer(member, "wei", 13);
    expect(registry.getFormations()[0].memberUnitIds).toEqual(["unit-1"]);
    expect(registry.getFormations()[0].status).toBe("DISBANDED");
    expect(registry.getPeople()[0].status).toBe("RETIRED");
    expect(registry.getPeople()[0].deathMonth).toBeUndefined();
  });

  it("counts a distant order only after ten years without meaningful approach", () => {
    vi.spyOn(worldRandom, "next").mockReturnValue(0);
    const registry = new MilitaryCommandRegistryStore();
    const qin: any = { name: "qin", status: "ACTIVE", users: new Set(), cities: [] };
    const wei: any = { name: "wei", status: "ACTIVE", users: new Set(), cities: [] };
    const commander = user(1, qin, "unit-1");
    const member = user(2, qin, "unit-2");
    commander.player.x = 0; member.player.x = 1;
    qin.users.add(commander); qin.users.add(member);
    const city: any = { id: "wei-far", ownerFactionId: "wei", ownerTeam: wei, block: { x: 1000, y: 0 } };
    registry.update(12, [qin, wei], [city]);
    expect(registry.getDiagnostics().staleOrderChecks).toBe(0);
    registry.update(132, [qin, wei], [city]);
    expect(registry.getDiagnostics().staleOrderChecks).toBe(0); // first distant sample establishes baseline
    registry.update(252, [qin, wei], [city]);
    expect(registry.getDiagnostics().staleOrderChecks).toBe(1);
  });
});
