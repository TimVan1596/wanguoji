import {createNaturalCore} from "./NaturalCoreHarness";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";
import Factions from "../FactionRegistry";
import {assessPopularSupport} from "../PopularRebellionSupport";
import Dynasty from "../../Politics/Dynasty";
import Military from "../../Politics/MilitaryCommandRegistry";
import {deriveMilitaryLifeSchedule} from "../../Politics/MilitaryLifeRules";
import Diplomacy from "../../Politics/Diplomacy";
import History from "../../History/WorldHistory";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import {hydrateWorldSave} from "../../Persistence/WorldSaveHydrator";
import {validateWorldSave} from "../../Persistence/WorldSaveValidator";
import {diffCanonicalWorldSave} from "../../Persistence/WorldSaveSchema";

/** Controlled real Core transactions, NOT a natural rebellion/appointment frequency experiment.
 * Documents the existing separate royal identity; never claims a resident is the new ruler. */
export async function runRebelMilitaryIdentity(seed="rebel-identity-z4") {
  const {core,game}=await createNaturalCore(seed),checks:string[]=[];
  const check=(ok:unknown,label:string)=>{if(!ok)throw new Error(label);checks.push(label);};
  const step=()=>{for(let n=0;n<30;n++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit("postupdate");};
  const strict=()=>{const save=exportWorldSave(core),v=validateWorldSave(save);if(!v.valid)throw new Error(v.errors.join("; "));return save;};
  try {
    core.setWorldRunning(false);
    const owner=core.teams.find(t=>t.status==="ACTIVE"&&t.cities.length)!,city=owner.cities[0];
    // Give the parent a real second city so this isolates founding transfer from final-city collapse.
    const site=core.map!.blocks.flat().find(b=>!b.team&&!b.city&&core.allCities.every(c=>Math.hypot(c.block.x-b.x,c.block.y-b.y)>320));
    check(site,"controlled setup has an unoccupied valid city site");
    if(!site)throw new Error("No city site");
    Factions.foundCity(owner,site,undefined,0);
    // Controlled local crisis and actual Player placement, never fake population or production probabilities.
    city.loyalty=0;city.devastation=100;
    const originals=[...owner.users].filter(u=>u.role==="NORMAL");
    for(const u of originals) { u.player.setPosition(city.block.x+1,city.block.y+1);(u.player.body as Phaser.Physics.Arcade.Body | undefined)?.reset(u.player.x,u.player.y); }
    const eligible=assessPopularSupport(city,0).users;
    check(eligible.length>=2,"real ordinary Users with valid local Player/registry bindings support the crisis");
    const before=core.teams.reduce((n,t)=>n+t.users.size,0),rebel=Factions.createRebelFaction({city,year:0,factionType:"REBEL"});
    check(rebel&&city.ownerFactionId===rebel.name,"actual popular transaction creates a polity and transfers its city");
    if(!rebel)throw new Error("No rebel polity");
    const supporters=originals.filter(u=>u.team===rebel),ruler=Dynasty.getCurrentRuler(rebel.name)!;
    check(supporters.length>0&&supporters.every(u=>!owner.users.has(u)&&rebel.users.has(u)),"supporter Users transfer once, retaining their original objects and birth identities");
    check(!supporters.includes(rebel.rulerUser!)&&supporters.every(u=>u.role==="NORMAL"&&!u.rulerId),"current founder is a separately generated royal identity, NOT a bound resident leader");
    check(core.teams.reduce((n,t)=>n+t.users.size,0)-before===(rebel.rulerUser?1:0)-(owner.rulerUser?0:1),"ordinary transfer conserves population; existing ruler lifecycle additions/removals are separate");
    check(History.getEventsForFaction(rebel.name).filter(e=>e.type==="rebel-faction-founded").length===1,"one canonical popular founding event");
    const candidates=supporters.filter(u=>u.bornMonth<=-216&&deriveMilitaryLifeSchedule({personId:"military-person-1",bornMonth:u.bornMonth}).retirementMonth>0);
    check(candidates.length>=1&&supporters.length>=2,"rebel has real eligible military candidates and existing members");
    const commander=candidates[0],members=[commander,...supporters.filter(u=>u!==commander)].slice(0,12);
    // Invoke the same appointment transaction used by the annual lottery; no claim about its probability.
    check((Military as any).appoint(commander,rebel.name,0,members.map(u=>u.player.logicalUnitId)),"a provisional rebel can receive a real commander, formation and initial office");
    const person=Military.getPerson(commander.militaryPersonId!)!,formation=Military.getFormations().find(f=>f.commanderPersonId===person.personId)!;
    check(commander.matchesMilitaryLife(person)&&formation.memberUnitIds.length===members.length,"rebel commander and all formation members have real unique identities");
    check(Military.getPoliticalInfluence(rebel,0,core.logicalUnitRegistry).candidates.length===0,"provisional command is distinct from formal-state coup participation");
    // Protect the immediate controlled transition without exceeding the existing two-relation cap.
    const peace=()=>{for(const t of [owner,...core.teams.filter(t=>t!==owner&&t!==rebel&&t.status==="ACTIVE").sort((a,b)=>Math.hypot(a.homeBlock!.x-city.block.x,a.homeBlock!.y-city.block.y)-Math.hypot(b.homeBlock!.x-city.block.x,b.homeBlock!.y-city.block.y)).slice(0,1)])Diplomacy.setRelation({factionAId:rebel.name,factionBId:t.name,status:"TRUCE",reason:"WAR_EXHAUSTION_TRUCE",startedMonth:core.simulator!.year,expiresMonth:core.simulator!.year+120});};
    peace();core.setWorldRunning(true);step();core.setWorldRunning(false);
    const oldName=rebel.displayName;check(rebel.formState("新邦",1),"controlled formal-state transition uses the existing polity");
    History.addStateFounded(1,rebel.name,oldName,rebel.displayName,Dynasty.getRulerDisplay(rebel.name),ruler.id,city.id,city.name);
    core.setWorldRunning(true);step();core.setWorldRunning(false);
    check(rebel.proclaimEmperor(2),"controlled imperial transition preserves the existing polity");
    History.addEmperorProclaimed(2,rebel.name,rebel.displayName,Dynasty.getRulerDisplay(rebel.name),ruler.id);
    check(Military.getPerson(person.personId)===person&&Military.getFormation(formation.commandId)===formation&&person.appointments.length===1,"rebel to kingdom to empire does not duplicate people, offices or formations");
    strict();
    const receiver=core.teams.find(t=>t!==rebel&&t.status==="ACTIVE")!;
    const population=core.teams.reduce((n,t)=>n+t.users.size,0),born=commander.bornMonth;
    commander.setTeam(receiver,{cause:"LIVE_TRANSFER",month:2});
    check(formation.status==="DISBANDED"&&person.status==="RETIRED"&&person.factionId===receiver.name&&person.appointments[0].endReason==="TRANSFERRED","real commander transfer ends old command; it is NOT a military revolt or a second army");
    check(commander.bornMonth===born&&core.teams.reduce((n,t)=>n+t.users.size,0)===population&&members.slice(1).every(u=>u.team===rebel),"transfer preserves identity/population and does not silently transfer the old troops");
    const save=strict();
    const resume=()=>{hydrateWorldSave(core,JSON.parse(JSON.stringify(save)));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return strict();};
    const first=resume(),second=resume();check(diffCanonicalWorldSave(first,second).matched,"V18 rebel polity and military histories resume deterministically for twelve months");
    check(second.registries.militaryCommandRegistry.people.some(p=>p.personId===person.personId&&p.appointments[0].factionId===rebel.name),"old rebel appointment history survives save, load and continuation");
    return {seed,scope:"controlled real Core transactions; no resident-ruler identity or military revolt implemented",checks,supporterCount:supporters.length,sourceUserId:commander.id,personId:person.personId,commandId:formation.commandId,saveSchemaVersion:18};
  } finally {game.destroy(true);}
}
