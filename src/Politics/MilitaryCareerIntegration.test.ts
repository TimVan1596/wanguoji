import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MilitaryCommandRegistryStore } from "./MilitaryCommandRegistry";
import { deriveMilitaryCareer } from "./MilitaryCareerEvidence";
import {validateMilitaryOffices} from "../Persistence/MilitaryOfficeValidation";
import {describeMilitaryOffice} from "./MilitaryOffice";
import WorldHistory from "../History/WorldHistory";
import worldRandom from "../Simulation/WorldRandom";
import Diplomacy from "./Diplomacy";
import { deriveMilitaryLifeSchedule } from "./MilitaryLifeRules";
import { validateMilitaryCommandState } from "../Persistence/MilitaryCommandValidation";

beforeEach(() => { WorldHistory.reset(); Diplomacy.reset(); });
afterEach(() => { vi.restoreAllMocks(); });

function fixture(reverse = false) {
  const registry = new MilitaryCommandRegistryStore();
  registry.setEventWriter(e => WorldHistory.addEvent(e));
  const team: any = { name: "qin", status: "ACTIVE", users: new Set(), cities: [] };
  const enemy: any = { name: "wei", status: "ACTIVE", users: new Set(), cities: [] };
  const users = [1, 2].map(id => ({ id, name: `人${id}`, bornMonth: -300, role: "NORMAL", team,
    militaryPersonId: undefined, player: { active: true, logicalUnitId: `unit-${id}`, x: 0, y: 0 } } as any));
  (reverse ? [...users].reverse() : users).forEach(u => team.users.add(u));
  const city: any = { id: "near", name: "近城", ownerFactionId: "wei", ownerTeam: enemy, block: { x: 100, y: 0 } };
  const capital: any = { id: "capital", name: "敌都", ownerFactionId: "wei", ownerTeam: enemy, isCapital: true, block: { x: 110, y: 0 } };
  enemy.capitalCity = capital;
  const draw = vi.spyOn(worldRandom, "next").mockReturnValueOnce(0).mockReturnValueOnce(.99).mockReturnValue(.99);
  registry.update(12, [team, enemy], [city, capital]);
  const person = registry.getPeople()[0], formation = registry.getFormations()[0];
  function capture(wasCapital = false, month = 20) {
    const id = WorldHistory.addCityCaptured(month, "qin", "wei", "wei", "战果城", `won-${month}`, wasCapital,
      false, 7, undefined, undefined, undefined, formation.commandId, person.personId);
    registry.recordCapture(formation.commandId, id, `won-${month}`, month);
    return id;
  }
  return { registry, team, enemy, users, city, capital, draw, person, formation, capture };
}

describe("real registry career influence", () => {
  it("unions actual service, deduplicates authoritative captures and separates ordinary/capital results", () => {
    const f = fixture();
    const id = f.capture(); f.registry.recordCapture(f.formation.commandId, id, "won-20", 20);
    f.capture(true, 24);
    f.registry.recordCommandSiegeContact(f.formation.commandId, f.person.personId, f.city.id);
    expect(f.registry.getCareer(f.person, 120)).toMatchObject({ serviceMonths: 108, appointmentCount: 1,
      ordinaryCaptures: 1, capitalCaptures: 1, currentUnitCount: 1, recordedCommandSize: 1 });
    expect(f.person.capturedEventIds).toHaveLength(2); expect(f.formation.captures).toHaveLength(2);
    const forged = structuredClone(f.person); forged.capturedEventIds.push("missing", "appointment");
    expect(deriveMilitaryCareer(forged, f.registry.getFormations(), WorldHistory.getEvents(), 120).verifiedCaptures).toBe(2);
  });

  it("does not turn orders, arrivals or siege contact into victories, and caps lifetime weight", () => {
    const f = fixture();
    f.registry.recordCommandSiegeContact(f.formation.commandId, f.person.personId, f.city.id);
    expect(f.registry.getCareer(f.person, 10000)).toMatchObject({ verifiedCaptures: 0 });
    expect(f.registry.getCareer(f.person, 10000).appointmentWeight).toBeLessThan(1.7);
    for (let month = 20; month < 40; month++) f.capture(true, month);
    expect(f.registry.getCareer(f.person, 10000).appointmentWeight).toBeLessThanOrEqual(2);
  });

  it("counts actual recovered-city results but never confuses a historical homeland capital with the enemy's capital", () => {
    const f = fixture();
    const recovered = (month: number, wasCapital?: boolean) => {
      const id = WorldHistory.addCityRecovered(month, "qin", "wei", "qin", "故都", `recovered-${month}`, true,
        7, undefined, undefined, f.formation.commandId, f.person.personId, wasCapital);
      f.registry.recordCapture(f.formation.commandId, id, `recovered-${month}`, month);
    };
    recovered(20, false); recovered(21, true); recovered(22);
    expect(f.registry.getCareer(f.person, 22)).toMatchObject({ verifiedCaptures: 3, ordinaryCaptures: 1,
      capitalCaptures: 1, unclassifiedCaptures: 1 });
  });

  it.each([false, true])("reappoints a verified veteran with a real capped advantage, independent of Set order (%s)", reverse => {
    const f = fixture(reverse); f.capture();
    f.registry.reconcileFactionEnd("qin", 240);
    const before = f.registry.getCareer(f.person, 252);
    expect(before.appointmentWeight).toBeGreaterThan(1);
    expect(before.currentUnitCount).toBe(0);
    f.draw.mockReset().mockReturnValueOnce(0).mockReturnValueOnce(.45).mockReturnValue(.99);
    f.registry.update(252, [f.team, f.enemy], [f.city, f.capital]);
    expect(f.draw).toHaveBeenCalledTimes(2);
    expect(f.registry.getPeople()).toHaveLength(1);
    expect(f.person.appointments).toHaveLength(2);
    expect(f.person.sourceUserId).toBe(2);
    expect(f.registry.getCareer(f.person, 264)).toMatchObject({ serviceMonths: 240, reappointments: 1 });
  });

  it("retains a nonzero newcomer interval and the annual 5% gate", () => {
    const f = fixture(); f.capture(); f.registry.reconcileFactionEnd("qin", 240);
    f.draw.mockReset().mockReturnValueOnce(.05);
    f.registry.update(252, [f.team, f.enemy], [f.city]);
    expect(f.draw).toHaveBeenCalledTimes(1); expect(f.registry.getPeople()).toHaveLength(1);
    f.draw.mockReset().mockReturnValueOnce(0).mockReturnValueOnce(.01);
    f.registry.update(264, [f.team, f.enemy], [f.city]);
    expect(f.draw).toHaveBeenCalledTimes(2);
    expect(f.registry.getPeople().find(p => p.status === "ACTIVE")?.sourceUserId).toBe(1);
  });

  it.each(["old", "dead"])("excludes %s veterans from reappointment", state => {
    const f = fixture(); f.registry.reconcileFactionEnd("qin", 24);
    const month = state === "old" ? Math.ceil(deriveMilitaryLifeSchedule(f.person).retirementMonth / 12) * 12 : 36;
    if (state === "dead") { f.person.status = "DEAD"; f.person.deathMonth = 24; }
    f.draw.mockReset().mockReturnValue(0);
    f.registry.update(month, [f.team, f.enemy], [f.city]);
    expect(f.person.appointments).toHaveLength(1);
    expect(f.registry.getCareer(f.person, month).currentUnitCount).toBe(0);
  });

  it("keeps valid orders; on invalidation prefers only a genuinely nearby attackable enemy capital", () => {
    const f = fixture(); f.capture();
    f.registry.update(21, [f.team, f.enemy], [f.city, f.capital]);
    expect(f.formation.targetCityId).toBe("near");
    f.formation.targetCityId = undefined;
    f.registry.update(22, [f.team, f.enemy], [f.city, f.capital]);
    expect(f.formation.targetCityId).toBe("capital");
    expect(f.registry.getOrderEvidence(f.formation)?.metadata?.meritInfluenced).toBe(1);
    const state = JSON.parse(JSON.stringify(f.registry.exportState())), history = JSON.parse(JSON.stringify(WorldHistory.exportState()));
    const restored = new MilitaryCommandRegistryStore(); restored.importState(state); WorldHistory.importState(history);
    expect(restored.getCareer(restored.getPeople()[0], 22)).toEqual(f.registry.getCareer(f.person, 22));
    expect(restored.getOrderEvidence(restored.getFormations()[0])?.metadata?.meritInfluenced).toBe(1);
    f.capital.block.x = 10000; f.formation.targetCityId = undefined;
    f.registry.update(23, [f.team, f.enemy], [f.city, f.capital]);
    expect(f.formation.targetCityId).toBe("near");
    vi.spyOn(Diplomacy, "canAttack").mockReturnValue(false);
    f.registry.update(24, [f.team, f.enemy], [f.city, f.capital]);
    expect(f.formation.targetCityId).toBeUndefined();
  });

  it("rejects a destroyed or foreign-labelled capital and enforces the absolute one-cell tolerance", () => {
    const f = fixture(); f.capture(); f.city.block.x = 1000; f.capital.block.x = 1040;
    f.formation.targetCityId = undefined;
    f.registry.update(21, [f.team, f.enemy], [f.city, f.capital]);
    expect(f.formation.targetCityId).toBe("near");
    f.capital.block.x = 1001; f.capital.destroyed = true; f.formation.targetCityId = undefined;
    f.registry.update(22, [f.team, f.enemy], [f.city, f.capital]);
    expect(f.formation.targetCityId).toBe("near");
    f.capital.destroyed = false; f.enemy.capitalCity = f.city; f.formation.targetCityId = undefined;
    f.registry.update(23, [f.team, f.enemy], [f.city, f.capital]);
    expect(f.formation.targetCityId).toBe("near");
  });

  it("strictly validates restored live members, merit-linked orders and historical capture identity", () => {
    const f = fixture(); f.capture(); f.formation.targetCityId = undefined;
    f.registry.update(22, [f.team, f.enemy], [f.city, f.capital]);
    const users = f.users.map(u => ({ userId: u.id, name: u.name, bornMonth: u.bornMonth, factionId: "qin", role: "NORMAL",
      playerUnitId: u.player.logicalUnitId, militaryPersonId: u.militaryPersonId }));
    const units = users.map(u => ({ unitId: u.playerUnitId, userId: u.userId, factionId: "qin", role: "NORMAL", alive: true }));
    const cities = [f.city, f.capital].map(c => ({ cityId: c.id, ownerFactionId: c.ownerFactionId }));
    const state = JSON.parse(JSON.stringify(f.registry.exportState())), history = JSON.parse(JSON.stringify(WorldHistory.exportState()));
    const validate = (s = state, h = history) => validateMilitaryCommandState(s, users, units, cities, new Set(["qin", "wei"]), 22, h);
    expect(validate()).toEqual([]);
    const noVictories = structuredClone(state); noVictories.people[0].capturedEventIds = []; noVictories.formations[0].captures = [];
    expect(validate(noVictories)).toContain("military order merit has no verified victory");
    const invalidHistory = structuredClone(history);
    invalidHistory.events.find((e: any) => e.type === "city-captured").metadata.commanderPersonId = "another-person";
    expect(validate(state, invalidHistory).some(e => e.includes("invalid capture evidence"))).toBe(true);
    const distant = structuredClone(history);
    distant.events.find((e: any) => e.type === "military-order-issued" && e.metadata.meritInfluenced === 1).metadata.targetDistance = 10000;
    expect(validate(state, distant)).toContain("invalid military order provenance");
    const invalidMembers = structuredClone(state); invalidMembers.formations[0].memberUnitIds.push("missing-unit");
    expect(validate(invalidMembers).some(e => e.includes("invalid member unit"))).toBe(true);
  });
});


describe("formal military offices use production careers and canonical history",()=>{
  function ready(){
    const f=fixture();
    for(const u of f.users)u.matchesMilitaryLife=(p:any)=>u.militaryPersonId===p.personId&&u.id===p.sourceUserId&&u.team.name===p.factionId;
    return f;
  }
  it("grants an initial office, then promotes only on annual checks with verified service and distinct new victories",()=>{
    const f=ready();
    expect(f.person.appointments[0].officeHistory?.[0]).toMatchObject({office:"XIAOWEI",month:12,serviceMonths:0,captureEventIds:[]});
    f.capture(false,20);f.capture(true,24);
    f.registry.update(24,[f.team,f.enemy],[f.city]);expect(f.person.appointments[0].officeHistory).toHaveLength(1);
    f.registry.update(48,[f.team,f.enemy],[f.city]);expect(describeMilitaryOffice(f.person,"qin")).toBe("现任裨将");
    f.registry.update(72,[f.team,f.enemy],[f.city]);expect(f.person.appointments[0].officeHistory).toHaveLength(2); // one unused result is insufficient
    f.capture(false,80);f.registry.update(84,[f.team,f.enemy],[f.city]);expect(describeMilitaryOffice(f.person,"qin")).toBe("现任将军");
    const before=worldRandom.exportState();f.registry.update(84,[f.team,f.enemy],[f.city]);expect(worldRandom.exportState()).toEqual(before);
    f.registry.update(132,[f.team,f.enemy],[f.city]);expect(f.person.appointments[0].officeHistory).toHaveLength(3);
    f.capture(true,140);f.registry.update(141,[f.team,f.enemy],[f.city]);expect(f.person.appointments[0].officeHistory).toHaveLength(3);
    f.registry.update(144,[f.team,f.enemy],[f.city]);
    const grants=f.person.appointments[0].officeHistory!;
    expect(grants.map(g=>g.office)).toEqual(["XIAOWEI","PIJIANG","JIANGJUN","SHANGJIANGJUN"]);
    expect(new Set(grants.flatMap(g=>g.captureEventIds)).size).toBe(4);
    expect(f.registry.getChronicle(f.person,144).filter(e=>e.source.startsWith("military-office-granted"))).toHaveLength(4);
    expect(f.registry.getOfficeSummary(144)).toMatchObject({xiaowei:1,pijiang:1,jiangjun:1,shangjiangjun:1,promotions:3,activeFormationSizes:[1]});
  });

  it.each(["no-merit","invalid-user","ended-command"])("does not promote through %s",mode=>{
    const f=ready();
    if(mode!=="no-merit"){f.capture(false,20);f.capture(true,24);}
    if(mode==="invalid-user")f.users.forEach(u=>u.matchesMilitaryLife=()=>false);
    if(mode==="ended-command")f.registry.reconcileFactionEnd("qin",36);
    f.registry.update(72,[f.team,f.enemy],[f.city]);
    expect(f.person.appointments[0].officeHistory).toHaveLength(mode==="no-merit"?2:1);
    if(mode==="no-merit")expect(f.person.appointments[0].officeHistory?.at(-1)?.promotionBasis).toBe("SERVICE");
  });
  it("validates the entire authoritative office chain, not just matching display metadata",()=>{
    const f=ready();f.capture(false,20);f.capture(true,24);f.registry.update(48,[f.team,f.enemy],[f.city]);f.capture(false,60);f.registry.update(84,[f.team,f.enemy],[f.city]);
    for(const month of [84,96,108])f.capture(false,month);
    f.registry.update(132,[f.team,f.enemy],[f.city]);
    const state=f.registry.exportState(),history=WorldHistory.getEvents();
    expect(validateMilitaryOffices(state,history,132)).toEqual([]);
    const mutateCases=[
      (s:any,h:any[])=>{const g=s.people[0].appointments[0].officeHistory[2];g.captureEventIds[0]=s.people[0].appointments[0].officeHistory[1].captureEventIds[0];h.find(e=>e.id===g.eventId).metadata.captureEventIds=JSON.stringify(g.captureEventIds);},
      (s:any,h:any[])=>{const g=s.people[0].appointments[0].officeHistory[2];g.month=60;g.serviceMonths=48;const e=h.find(e=>e.id===g.eventId);e.year=e.monthIndex=60;e.metadata.serviceMonths=48;},
      (s:any,h:any[])=>{const g=s.people[0].appointments[0].officeHistory[2];h.find(e=>e.id===g.eventId).actorFactionId="wei";},
      (s:any)=>{s.people[0].appointments[0].officeHistory.push({...s.people[0].appointments[0].officeHistory[2]});},
      (s:any)=>{delete s.people[0].appointments[0].officeHistory;},
      (_s:any,h:any[])=>{h.push({...h.find(e=>e.type==="military-office-granted"),id:"orphan-office"});},
    ];
    for(const mutate of mutateCases){const s=structuredClone(state),h=structuredClone(history);mutate(s,h);expect(validateMilitaryOffices(s,h,132).length).toBeGreaterThan(0);}
  });
  it("keeps foreign, ended and posthumous offices historical; a new country grants its own initial office",()=>{
    const f=ready();f.capture(false,20);f.capture(true,24);f.registry.update(48,[f.team,f.enemy],[f.city]);f.capture(false,60);f.registry.update(84,[f.team,f.enemy],[f.city]);
    const commander=f.users.find(u=>u.id===f.person.sourceUserId)!,old=structuredClone(f.person.appointments[0].officeHistory);
    f.registry.onUserTransfer(commander,"wei",92);f.team.users.delete(commander);commander.team=f.enemy;f.enemy.users.add(commander);
    f.enemy.users.add({...f.users[0],id:3,name:"新国居民",militaryPersonId:undefined,team:f.enemy,player:{active:true,logicalUnitId:"unit-3",x:0,y:0}});
    f.draw.mockReset().mockReturnValue(0);
    f.registry.update(96,[f.team,f.enemy],[f.city]);
    expect(f.person.appointments).toHaveLength(2);
    expect(f.person.appointments[0].officeHistory).toEqual(old);
    expect(describeMilitaryOffice(f.person,"qin")).toBe("原任将军（本国历史最高职务）");
    expect(describeMilitaryOffice(f.person,"wei")).toBe("现任校尉");
    f.registry.update(144,[f.team,f.enemy],[f.city]);
    expect(f.person.appointments[1].officeHistory).toHaveLength(1); // old-country victories cannot promote
    f.registry.onUserDestroyed(commander,145,"BATTLE_DEATH");
    expect(f.person.status).toBe("DEAD");
    expect(describeMilitaryOffice(f.person,"wei")).toBe("原任校尉（本国历史最高职务）");
    expect(f.person.appointments[0].officeHistory).toEqual(old);
    expect(f.registry.getFormations().filter(a=>a.commanderPersonId===f.person.personId).every(a=>a.status==="DISBANDED")).toBe(true);
    expect(f.registry.getChronicle(f.person,145,"wei").some(e=>e.source.startsWith("military-person-died")&&e.text.includes("战死"))).toBe(true);
  });
  it("age retirement ends current authority and preserves the actual granted office",()=>{
    const f=ready(),month=Math.ceil(deriveMilitaryLifeSchedule(f.person).retirementMonth/12)*12;
    f.registry.update(month,[f.team,f.enemy],[f.city]);
    expect(f.person.status).toBe("RETIRED");
    expect(f.person.deathMonth).toBeUndefined();
    expect(describeMilitaryOffice(f.person,"qin")).toBe("原任校尉（本国历史最高职务）");
    expect(f.person.appointments[0].endReason).toBe("AGE_RETIREMENT");
  });
});
