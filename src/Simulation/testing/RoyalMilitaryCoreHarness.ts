import {formatRulerLifeAge} from "../../UI/Components/FactionDetails/RoyalPresentation";
import {checkRoyalArchiveInteraction} from "./RoyalArchiveInteractionHarness";
import {evaluateDepositionOpportunity,chooseDepositionClaimant} from "../../Politics/InReignDeposition";
import {getFactionStability} from "../../Components/City";
import worldRandom from "../WorldRandom";
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
  await checkRoyalArchiveInteraction(core,team.name,personId,check);
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
   const {t,d,r}=restore(),old=Dynasty.getCurrentRuler(t.name)!,capital=t.capitalCity!;
   const enemy=core.teams.find(e=>e!==t&&e.status==="ACTIVE")!,town=enemy.cities[0];
   town.capture(t,month);capital.capture(enemy,month);
   for(const city of t.cities)city.loyalty=20;
   const evaluation=evaluateDepositionOpportunity({factionId:t.name,status:t.status,identityStage:t.identityStage,cityCount:t.cities.length,stability:getFactionStability(t),currentRuler:old,rulers:d.rulers,houseName:d.houseName,worldMonth:month,events:History.getEvents()});
   check(evaluation.eligible,"real capital loss creates a legal deposition opportunity");
   const roll=Array.from({length:1000},(_,i)=>evaluation.probability*(i+.5)/1000).find(value=>chooseDepositionClaimant(evaluation,month,value)?.claimant.ruler.id===r.id);
   check(roll!==undefined,"the serving real royal is a legal claimant under the unchanged selection rules");
   const checkpoint=strict(),writer=History.addRulerDeposed,originalNext=worldRandom.next;
   const force=()=>{let first=true;worldRandom.next=()=>{const actual=originalNext.call(worldRandom);if(first){first=false;return roll!;}return actual;};};
   force();History.addRulerDeposed=function(...args:Parameters<typeof writer>){writer.apply(this,args);throw new Error("injected royal deposition failure");};
   try{(Dynasty as any).evaluateInReignDeposition(t,d,old,month);}finally{History.addRulerDeposed=writer;worldRandom.next=originalNext;}
   const failed=strict(),expected=structuredClone(checkpoint);expected.dynasties.find(d=>d.factionId===t.name)!.lastDepositionAttemptMonth=month;failed.worldRandom=expected.worldRandom;
   check(diffCanonicalWorldSave(expected,failed).matched,"failed deposition restores the royal's military authority, User role and formation");
   hydrateWorldSave(core,JSON.parse(JSON.stringify(checkpoint)));
   const liveTeam=core.teams.find(x=>x.name===t.name)!,liveDynasty=Dynasty.get(t.name)!;
   force();try{(Dynasty as any).evaluateInReignDeposition(liveTeam,liveDynasty,Dynasty.getCurrentRuler(t.name)!,month);}finally{worldRandom.next=originalNext;}
   check(Dynasty.getCurrentRuler(t.name)?.id===r.id&&Military.getPerson(personId)?.status==="RETIRED"&&liveTeam.rulerUser?.historicalPersonId===personId,"successful legal deposition converts the same serving royal and ends old command");strict();
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
   const enemy=core.teams.find(e=>e!==t&&e.status==="ACTIVE")!;
   // Controlled administrative terminal transaction, not a claim of natural union eligibility.
   (core.simulator as any).mergeFaction({absorbedFaction:t,absorbingFaction:enemy},month+1);
   const terminalSave=strict();
   const former=enemy.getUserById(identity.sourceUserId)!;
   check(r.status as string==="abdicated"&&former.role==="NORMAL"&&r.deathMonth===undefined,"administrative termination preserves the former royal's real living body");
   (core.simulator as any).clock.importState({worldMonth:month+2,elapsedMs:0,running:false});
   check(former.destroyUser(false,{cause:"BATTLE_DEATH",month:month+2,damageSource:"HOSTILE_HOME_OCCUPATION"}),"former ruler's actual body can subsequently die in war");
   check(r.endYear===month+1&&r.politicalEndYear===month+1&&r.endReason==="合邦退位"&&r.deathMonth===month+2&&r.chronicle?.endSnapshot?.month===month+1&&r.chronicle.deathCause==="战死","later death preserves the earlier political end and terminal reign snapshot");
   const deadSave=strict();hydrateWorldSave(core,JSON.parse(JSON.stringify(deadSave)));
   const deadRecord=Dynasty.get(t.name)!.rulers.find(x=>x.id===r.id)!;
   check(formatRulerLifeAge(deadRecord,month+120,false,false).startsWith("享年"),"actual death survives load and never displays current age");
   hydrateWorldSave(core,JSON.parse(JSON.stringify(terminalSave)));
   const living=Dynasty.get(t.name)!.rulers.find(x=>x.id===r.id)!;
   check(formatRulerLifeAge(living,month+1,false,false).startsWith("当前年龄"),"loaded terminal polity retains the person's actual living age");
   (core.simulator as any).clock.importState({worldMonth:death!-1,elapsedMs:0,running:false});
   core.setWorldRunning(true);step();core.setWorldRunning(false);
   check(living.status as string==="dead"&&living.deathMonth===death&&living.endYear===month+1&&Military.getPerson(personId)?.deathMonth===death,"loaded terminal person reaches natural death while preserving the original political end");strict();
  }
  return {seed,checks,month,personId,royalRulerId:ruler.id,saveSchemaVersion:21};
 } finally {game.destroy(true);}
}
