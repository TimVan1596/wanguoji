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
  it("clears a newly friendly or destroyed target immediately without rolling a replacement order",()=>{
    const registry=new MilitaryCommandRegistryStore(),qin:any={name:"qin",status:"ACTIVE",users:new Set(),cities:[]};
    const wei:any={name:"wei",status:"ACTIVE",users:new Set(),cities:[]};
    qin.users.add(user(1,qin,"unit-1"));qin.users.add(user(2,qin,"unit-2"));
    const draw=vi.spyOn(worldRandom,"next").mockReturnValue(0);
    registry.update(12,[qin,wei],[{id:"target",ownerFactionId:"wei",ownerTeam:wei,block:{x:32,y:0}} as any]);
    draw.mockRestore();const formation=registry.getFormations()[0],before=worldRandom.exportState();
    expect(formation.targetCityId).toBe("target");
    registry.clearObsoleteCityTarget("target","third-country");expect(formation.targetCityId).toBe("target");
    registry.clearObsoleteCityTarget("target","qin");expect(formation.targetCityId).toBeUndefined();expect(formation.orderStartMonth).toBeUndefined();
    expect(worldRandom.exportState()).toEqual(before);expect(formation.status).toBe("ACTIVE");expect(formation.memberUnitIds).toEqual(["unit-1"]);
  });

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
    const city: any = { id: "z-wei-capital", ownerFactionId: "wei", ownerTeam: wei, block: { x: 64, y: 0 }, registerSiegeContact };

    registry.update(12, [qin, wei], [farCity, city]);
    draw.mockRestore();

    const [person] = registry.getPeople();
    const [formation] = registry.getFormations();
    expect(person).toMatchObject({ sourceUserId: 1, name: "人口1", bornMonth: -300, status: "ACTIVE" });
    expect(commander.militaryPersonId).toBe(person.personId);
    expect(formation).toMatchObject({ factionId: "qin", commanderPersonId: person.personId, memberUnitIds: ["unit-1"], targetCityId: "z-wei-capital" });
    expect(events.filter(event => event.type === "military-appointment")).toHaveLength(1);
    expect(events.filter(event => event.type === "military-order-issued")).toHaveLength(1);
    expect(events.find(event => event.type === "military-order-issued").metadata.meritInfluenced).toBe(0);
    expect(registry.getDiagnostics()).toMatchObject({ candidates: 2, eligible: 2, appointments: 1, activeCommanders: 1, activeFormations: 1, orders: 1 });

    const units: any[] = ["unit-1"].map(unitId => ({ unitId, factionId: "qin", logicalX: 0,
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
    expect(contactResult.siegeContacts).toBe(1);
    expect(registerSiegeContact).toHaveBeenCalledTimes(1);
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
    expect(registry.getFormations()[0].status).toBe("ACTIVE");
    expect(registry.getPeople()[0].status).toBe("ACTIVE");
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


it.each(["user","player"])("blocks a NORMAL unit retaining a %s royal identity from appointment and formation membership",binding=>{
  const registry=new MilitaryCommandRegistryStore(),team:any={name:"qin",status:"ACTIVE",users:new Set(),cities:[]};
  const royal=user(1,team,"unit-1"),ordinary=user(2,team,"unit-2");
  if(binding==="user")royal.rulerId="king";else royal.player.rulerId="king";
  team.users.add(royal);team.users.add(ordinary);
  const draw=vi.spyOn(worldRandom,"next").mockReturnValue(0);
  registry.update(12,[team],[]);
  expect(registry.getPeople().map(p=>p.sourceUserId)).toEqual([ordinary.id]);expect(registry.getFormations()[0].memberUnitIds).toEqual([ordinary.player.logicalUnitId]);expect(royal.militaryPersonId).toBeUndefined();expect(draw).toHaveBeenCalledTimes(2);
});
it("revokes a formation if its commander acquires an incompatible royal binding, without recording death",()=>{
  const registry=new MilitaryCommandRegistryStore(),team:any={name:"qin",status:"ACTIVE",users:new Set(),cities:[]};
  const commander=user(1,team,"unit-1");team.users.add(commander);team.users.add(user(2,team,"unit-2"));
  vi.spyOn(worldRandom,"next").mockReturnValue(0);registry.update(12,[team],[]);
  const person=registry.getPeople()[0];commander.rulerId="king";
  registry.update(13,[team],[]);
  expect(person.status).toBe("RETIRED");expect(person.deathMonth).toBeUndefined();
  expect(person.appointments[0]).toMatchObject({endMonth:13,endReason:"DISMISSED"});
  expect(registry.getFormations()[0].status).toBe("DISBANDED");
});


it.each(["id", "name", "bornMonth", "faction"])("a stale %s binding cannot transfer another commander's identity or office", field => {
  const registry = new MilitaryCommandRegistryStore();
  const qin:any = { name: "qin", status: "ACTIVE", users: new Set(), cities: [] };
  const commander = user(1, qin, "unit-1");
  qin.users.add(commander); qin.users.add(user(2, qin, "unit-2"));
  vi.spyOn(worldRandom, "next").mockReturnValue(0); registry.update(12, [qin], []);
  const person = registry.getPeople()[0], before = registry.exportState(), rng = worldRandom.exportState();
  const stale = { ...commander, player: { ...commander.player, logicalUnitId: "unrelated-unit" } };
  if (field === "id") stale.id++;
  if (field === "name") stale.name = "unrelated population";
  if (field === "bornMonth") stale.bornMonth--;
  if (field === "faction") stale.team = { name: "other" };
  registry.onUserTransfer(stale, "wei", 20);
  expect(registry.exportState()).toEqual(before); expect(person.factionId).toBe("qin");
  expect(worldRandom.exportState()).toEqual(rng);
});


it.each(["REBEL", "SPLIT", "KINGDOM"])("%s military command ends cleanly when its polity terminates", factionType => {
  const registry = new MilitaryCommandRegistryStore();
  const team:any = { name: "test-polity", factionType, identityStage: factionType === "KINGDOM" ? "STATE" : "PROVISIONAL", status: "ACTIVE", users: new Set(), cities: [] };
  const commander = user(1, team, "unit-1"); team.users.add(commander); team.users.add(user(2, team, "unit-2"));
  const events:any[] = []; registry.setEventWriter(e=>{events.push(e);return e.id;});
  vi.spyOn(worldRandom,"next").mockReturnValue(0); registry.update(12,[team],[]);
  const person=registry.getPeople()[0],formation=registry.getFormations()[0];
  expect(person.appointments[0].officeHistory?.[0].office).toBe("XIAOWEI");
  expect(formation.memberUnitIds).toEqual(["unit-1"]); expect(team.users.size).toBe(2);
  team.status="EXTINCT"; registry.update(13,[team],[]);
  expect(formation.status).toBe("DISBANDED"); expect(person.status).toBe("RETIRED"); expect(person.deathMonth).toBeUndefined();
  expect(person.appointments[0]).toMatchObject({factionId:team.name,endMonth:13,endReason:"FACTION_ENDED"});
  expect(events.some(e=>e.type==="military-command-ended")).toBe(true);expect(events.some(e=>e.type==="military-person-died")).toBe(false);
});

it('new junior appointments use exactly one person even with a large real pool, and reject oversized entry calls atomically',()=>{
 const registry=new MilitaryCommandRegistryStore(),team:any={name:'qin',status:'ACTIVE',users:new Set(),cities:[]};
 for(let i=1;i<=20;i++)team.users.add(user(i,team,'unit-'+i));
 const draw=vi.spyOn(worldRandom,'next').mockReturnValue(0);registry.update(12,[team],[]);registry.update(24,[team],[]);draw.mockRestore();
 expect(registry.getFormations().map(f=>f.memberUnitIds.length)).toEqual([1,1]);
 expect(new Set(registry.getFormations().flatMap(f=>f.memberUnitIds)).size).toBe(2);expect(team.users.size).toBe(20);
 const before=registry.exportState(),candidate=[...team.users][10];
 expect((registry as any).appoint(candidate,'qin',36,['unit-11','unit-12','unit-13'])).toBe(false);expect(registry.exportState()).toEqual(before);
});
