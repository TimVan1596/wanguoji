import {createNaturalCore} from "./NaturalCoreHarness";
import {SIMULATION_FIXED_STEP_MS} from "../SimulationDriver";
import Dynasty from "../../Politics/Dynasty";
import Military from "../../Politics/MilitaryCommandRegistry";
import History from "../../History/WorldHistory";
import {exportWorldSave} from "../../Persistence/WorldSaveExporter";
import {hydrateWorldSave} from "../../Persistence/WorldSaveHydrator";
import {validateWorldSave} from "../../Persistence/WorldSaveValidator";
import {diffCanonicalWorldSave} from "../../Persistence/WorldSaveSchema";
import {preAccessionMilitary} from "../../Politics/PersonServiceLinks";

/** Controlled rare career, using real Core/Phaser, population and political transactions. */
export async function runRoyalMilitaryCore(seed="royal-military-z11") {
 const {core,game}=await createNaturalCore(seed),checks:string[]=[];
 const check=(value:unknown,label:string)=>{if(!value)throw new Error(label);checks.push(label);console.info(`[CoreTest] ${checks.length}: ${label}`);};
 const step=()=>{const before=core.simulator!.year;for(let i=0;i<30;i++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit("postupdate");if(core.simulator!.year!==before+1)throw new Error("Clock stalled");};
 const strict=()=>{const s=exportWorldSave(core),v=validateWorldSave(s);if(!v.valid)throw new Error(v.errors.join("; "));return s;};
 try {
  let team=core.teams.find(t=>Dynasty.getRoyalMilitaryCandidates(t,0).length>0);
  for(let m=0;!team&&m<600;m++){step();team=core.teams.find(t=>Military.getPeople().filter(p=>p.status==="ACTIVE"&&p.factionId===t.name).length<2&&Dynasty.getRoyalMilitaryCandidates(t,core.simulator!.year).length>0);}
  check(team,"real adult kin candidate exists");if(!team)throw new Error("No royal candidate");
  core.setWorldRunning(false);const month=core.simulator!.year,candidate=Dynasty.getRoyalMilitaryCandidates(team,month)[0];
  const dynasty=Dynasty.get(team.name)!,ruler=dynasty.rulers.find(r=>r.id===candidate.rulerId)!;
  const birth=ruler.bornYear,death=ruler.naturalDeathYear,parent=ruler.parentId;
  const members=()=>[...team!.users].filter(u=>u.role==="NORMAL"&&!u.rulerId&&u.player.logicalUnitId&&!Military.isAssigned(u.player.logicalUnitId)).slice(0,11);
  const before=strict(),count=team.users.size;
  const writer=History.addEvent;
  // Exercise failure after the real User and part of its history have already been prepared.
  History.addEvent=function(...args:Parameters<typeof writer>){if(args[0].type==="military-office-granted")throw new Error("injected enlistment history failure");return writer.apply(this,args);};
  try { check(!Dynasty.enlistRoyalMilitary(candidate,team,month,members()),"history failure rolls back real enlistment"); } finally {History.addEvent=writer;}
  check(diffCanonicalWorldSave(before,strict()).matched,"failed enlistment restores canonical state and sequences");
  check(Dynasty.enlistRoyalMilitary(candidate,team,month,members()),"real royal enlistment succeeds");
  const identity=ruler.militaryIdentity!,personId=identity.personId,user=team.getUserById(identity.sourceUserId)!,person=Military.getPerson(personId)!;
  check(user&&user.player.active&&user.matchesMilitaryLife(person)&&team.users.size===count+1,"one audited real body commands existing people");
  check(ruler.bornYear===birth&&ruler.naturalDeathYear===death&&ruler.parentId===parent&&person.royalIdentity?.naturalDeathMonth===death,"birth, kinship and existing lifespan are preserved");
  check(!Dynasty.enlistRoyalMilitary(candidate,team,month,members()),"duplicate enlistment refused");
  const save=strict();
  for(const mutate of [(s:any)=>s.registries.militaryCommandRegistry.people.find((p:any)=>p.personId===personId).royalIdentity.naturalDeathMonth++, (s:any)=>s.dynasties.find((d:any)=>d.factionId===team!.name).rulers.find((r:any)=>r.rulerId===ruler.id).militaryIdentity.sourceUserId++, (s:any)=>s.users.push({...s.users.find((u:any)=>u.militaryPersonId===personId),userId:123})]){const bad=structuredClone(save);mutate(bad);check(!validateWorldSave(bad).valid,"V21 rejects broken royal life/body references");}
  const resume=()=>{hydrateWorldSave(core,JSON.parse(JSON.stringify(save)));core.setWorldRunning(true);for(let i=0;i<12;i++)step();core.setWorldRunning(false);return strict();};
  const first=resume(),second=resume();check(diffCanonicalWorldSave(first,second).matched,"royal military V21 twelve-month continuation is deterministic");
  hydrateWorldSave(core,JSON.parse(JSON.stringify(first)));check(diffCanonicalWorldSave(first,strict()).matched,"resaved world loads again without another person");
  // Replay separate branches from the same valid career checkpoint.
  const restore=()=>{hydrateWorldSave(core,JSON.parse(JSON.stringify(save)));return {t:core.teams.find(t=>t.name===team!.name)!,d:Dynasty.get(team!.name)!,r:Dynasty.get(team!.name)!.rulers.find(r=>r.id===candidate.rulerId)!,p:Military.getPerson(personId)!};};
  {
   const {t,d,r,p}=restore(),u=t.getUserById(identity.sourceUserId)!;
   check(u.destroyUser(false,{cause:"BATTLE_DEATH",month,damageSource:"HOSTILE_HOME_OCCUPATION"}),"royal combat casualty uses real User destruction");
   check(r.status==="dead"&&p.status==="DEAD"&&r.deathMonth===p.deathMonth&&!d.heirIds.includes(r.id)&&Military.getFormations().every(f=>f.commanderPersonId!==personId||f.status==="DISBANDED"),"battle death closes royal succession, military life and command");strict();
  }
  {
   const {t,r,p}=restore();r.naturalDeathYear=month+1;r.plannedEndYear=month+1;p.royalIdentity!.naturalDeathMonth=month+1;
   core.setWorldRunning(true);step();core.setWorldRunning(false);
   check(r.status==="dead"&&p.status==="DEAD"&&r.deathMonth===month+1&&p.deathMonth===month+1&&!t.getUserById(identity.sourceUserId),"royal natural schedule closes both archives and the body on the same month");strict();
  }
  {
   const {t,r,p}=restore(),command=p.appointments[0].commandId;
   const clock=(m:number)=>(core.simulator as any).clock.importState({worldMonth:m,elapsedMs:0,running:false});
   clock(month+60);
   const targets=core.allCities.filter(c=>c.ownerTeam!==t).slice(0,5);
   check(targets.length===5,"controlled merit scenario has five real enemy cities");
   for(const target of targets.slice(0,2))target.capture(t,month+60,undefined,command,personId);
   const formation=Military.getFormation(command)!,size=formation.memberUnitIds.length;
   (Military as any).advanceOffices(month+60,core.teams);
   check(p.appointments[0].officeHistory?.at(-1)?.office==="JIANGJUN"&&p.capturedEventIds.length===2,"five years and two real City.capture results promote the royal to general");
   clock(month+61);for(const target of targets.slice(2))target.capture(t,month+61,undefined,command,personId);
   clock(month+120);(Military as any).advanceOffices(month+120,core.teams);
   check(p.appointments[0].officeHistory?.at(-1)?.office==="SHANGJIANGJUN"&&formation.memberUnitIds.length===size,"three new actual victories and ten years grant senior office without adding troops");
   check(r.reignOrdinal===undefined&&!r.chronicle,"pre-accession victories create no ruler reign or personal royal campaign score");strict();
   Military.endPersonCommands(personId,month+120,"DISMISSED");
   check(p.status==="RETIRED"&&formation.status==="DISBANDED"&&r.deathMonth===undefined,"dismissal ends command without ending the royal's life");strict();
  }
  {
   const {t,r,p}=restore();t.markExiled(month);Dynasty.markExiled(t,month);Military.update(month,core.teams,core.allCities);
   check(p.status==="RETIRED"&&r.deathMonth===undefined&&Military.getFormations().every(f=>f.commanderPersonId!==personId||f.status==="DISBANDED"),"exile ends real military office without killing royal kin");
   t.markExtinct(month);Dynasty.markExtinct(t,month);
   check(r.status==="kin"&&r.deathMonth===undefined,"political termination removes succession eligibility without manufacturing a death");
   (core.simulator as any).clock.importState({worldMonth:death!,elapsedMs:0,running:false});Dynasty.update(death!,core.teams);
   check(r.status as string==="dead"&&r.deathMonth===death&&p.deathMonth===death,"terminated country's royal military person retains the one natural life clock");
  }
  {
   const {t,d,r,p}=restore(),current=Dynasty.getCurrentRuler(t.name)!;
   // Legitimate heir designation is a test setup; the production consume/succeed path selects him.
   d.designatedHeirId=r.id;d.designatedSinceMonth=month;d.heirIds=[r.id];r.status="heir";
   current.naturalDeathYear=month+1;current.plannedEndYear=month+1;
   core.setWorldRunning(true);step();core.setWorldRunning(false);
   check(Dynasty.getCurrentRuler(t.name)===r&&t.rulerUser?.historicalPersonId===personId&&p.politicalRulerId===r.id,"legal succession converts the same royal User into the ruler");
   check(p.status==="RETIRED"&&Military.getFormations().every(f=>f.commanderPersonId!==personId||f.status==="DISBANDED")&&r.parentId===parent&&r.bornYear===birth&&r.naturalDeathYear===death,"accession closes old commands and preserves kin and life");
   check(preAccessionMilitary(r,Military.getPeople(),Military.getFormations(),History.getEvents())?.person.personId===personId,"ruler biography resolves the same pre-accession military person");strict();
  }
  return {seed,checks,month,personId,royalRulerId:ruler.id,saveSchemaVersion:21};
 } finally {game.destroy(true);}
}
