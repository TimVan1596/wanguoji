import Military,{deriveUserBornMonth} from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {getLocalUserId} from '../../Live/LocalDanmaku';
import {planFamilyPopulationEntry,familyAppointmentWeight} from '../../Politics/MilitaryFamily';
import {hereditaryAppointmentWeight} from '../../Politics/HereditaryRecruitment';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Real adult population entry, real father death, formal grant source inheritance, real initial appointment. */
export function checkPoliticalPeerageInheritance(core:any,factionId:string,personId:string,check:(v:unknown,s:string)=>void,worldMonth=264){
 const original=exportWorldSave(core),team=()=>core.teams.find((t:any)=>t.name===factionId),family=()=>Military.getFamilies().find(f=>f.founderPersonId===personId)!;
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const strict=()=>{const s=exportWorldSave(core),v=validateWorldSave(s);check(v.valid,`political inheritance strict save: ${v.errors.join(';')}`);return s;};
 try{
  clock(worldMonth);const t=team(),population=core.simulator.population,epoch=family().epochFounderId;
  while(t.users.size>=population.getCapacity(t)){const u=[...t.users].find((u:any)=>u.role==='NORMAL'&&!u.militaryPersonId&&!Military.getFormations().some(f=>f.status==='ACTIVE'&&f.memberUnitIds.includes(u.player.logicalUnitId??''))) as any;check(u,'existing civilian permits a controlled population-capacity fixture');u.destroyUser(false,{cause:'GOD_ACTION',month:worldMonth});}
  let counter:number|undefined;
  for(let n=Math.max(1,(population.counters[factionId]??0)+1);n<5000;n++){const label=`${t.shortName??t.name}-${String(n).padStart(3,'0')}`,id=getLocalUserId(label),born=deriveUserBornMonth(id,label,factionId,worldMonth);if(core.teams.some((t:any)=>t.getUserById(id))||Military.getPeople().some(p=>p.sourceUserId===id)||Military.getFamilies().some(f=>f.members.some(m=>m.sourceUserId===id))||History.getRecordedEvents().some(e=>{try{return e.type==='court-coup-attempt'&&JSON.parse(String(e.metadata?.courtCoup)).members.some((u:any)=>u.userId===id);}catch{return false;}}))continue;const plan=planFamilyPopulationEntry(Military.getFamilies(),factionId,epoch,id,born,worldMonth,String(random.exportState().seed));if(plan?.familyId===family().familyId){counter=n;break;}}
  check(counter!==undefined,'real population creation can register a plausible child of the formal peerage founder');population.counters[factionId]=counter!-1;
  const beforePopulation=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),child=population.spawn(t,undefined,false,{cause:'NATURAL_GROWTH',month:worldMonth});
  check(child?.familyMemberId&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===beforePopulation+1&&!child.militaryPersonId,'one normal population entry supplies the real child, not an additional noble or soldier');
  strict();Military.updateFamilyTitles(worldMonth,core.teams,Dynasty.getAll());check(!family().nobleSuccession?.length,'living formally granted BO founder gives no premature inheritance');
  const father=t.getUserById(Military.getPerson(personId)!.sourceUserId);check(father.destroyUser(false,{cause:'BATTLE_DEATH',month:worldMonth}),'formal peerage founder dies through the existing User death transaction');
  const death=strict(),writer=History.addEvent;
  History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='family-title-succeeded')throw Error('injected political inheritance write');return id;};try{Military.updateFamilyTitles(worldMonth,core.teams,Dynasty.getAll());}finally{History.addEvent=writer;}
  check(diffCanonicalWorldSave(death,exportWorldSave(core)).matched,'formal grant source inheritance write failure restores the entire family/history/RNG transaction');
  Military.updateFamilyTitles(worldMonth,core.teams,Dynasty.getAll());const act=family().nobleSuccession?.at(-1),grant=Military.getPerson(personId)!.nobilityHistory!.find(g=>g.rank==='BO')!;
  check(act?.kind==='SUCCEEDED'&&act.rank==='ZI'&&act.sourceGrantEventId===grant.eventId&&family().members.find(m=>m.memberId===act.holderMemberId)?.sourceUserId===child.id,'founder formally granted BO descends to one real civilian child as ZI with the original political event source');
  check(!child.militaryPersonId&&child.role==='NORMAL','legitimate political heir remains a civilian without a military appointment');
  const saved=strict(),member=family().members.find(m=>m.sourceUserId===child.id)!,base=familyAppointmentWeight(family(),member,factionId,epoch,worldMonth,(Military as any).royalService?.calibration?.()),weight=hereditaryAppointmentWeight(family(),member,factionId,epoch,worldMonth,base,'LOW');
  {const before=exportWorldSave(core),standing=Military.getHereditaryAppointmentStanding(family().familyId,member.memberId,core.teams,worldMonth);check(standing?.status.includes('初任资格')&&standing.formalReserve===false&&!child.militaryPersonId&&diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'a real titled civilian has readable current entry qualification without a fake reserve officer or canonical mutation');}
  check(weight===Math.max(base,1.5),'inherited ZI gives bounded candidate standing without stacking family and title advantages');
  const candidates=[...t.users].filter((u:any)=>(Military as any).isEligible(u,worldMonth)).sort((a:any,b:any)=>a.id-b.id||a.name.localeCompare(b.name)) as any[],royals=(Military as any).royalService?.candidates(t,worldMonth)??[];
  const weights=candidates.map(u=>{const p=u.militaryPersonId&&Military.getPerson(u.militaryPersonId),l=Military.getFamilyMember(u.id,u.bornMonth);return p?Military.getCareer(p,worldMonth).appointmentWeight:hereditaryAppointmentWeight(l?.family,l?.member,factionId,epoch,worldMonth,familyAppointmentWeight(l?.family,l?.member,factionId,epoch,worldMonth,(Military as any).royalService?.calibration?.()),'LOW');}),index=candidates.indexOf(child),roll=(weights.slice(0,index).reduce((n,w)=>n+w,0)+weights[index]/2)/(weights.reduce((n,w)=>n+w,0)+royals.length),next=random.next;let calls=0;
  random.next=()=>{next.call(random);return calls++===0?0:roll;};try{Military.update(worldMonth,[t],core.allCities);}finally{random.next=next;}
  const person=child.militaryPersonId&&Military.getPerson(child.militaryPersonId);
  check(calls===2&&person?.appointments.at(-1)?.officeHistory?.at(-1)?.office==='XIAOWEI'&&!person.nobilityHistory&&person.capturedEventIds.length===0,'one existing shared national opportunity appoints the real inherited civilian as XIAOWEI, with no ancestral combat or title copied');strict();
  {
   hydrateWorldSave(core,structuredClone(saved));Military.setHereditaryRecruitmentForSimulation('MEDIUM');
   const writer=History.addEvent,transaction=(Military as any).familyTransaction,next=random.next;let checkpoint:ReturnType<typeof exportWorldSave>|undefined,calls=0;
   (Military as any).familyTransaction=function(t:any,work:any){if(work.name==='attempt')checkpoint=exportWorldSave(core);return transaction.call(this,t,work);};
   History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='military-appointment'&&e.metadata?.sourceUserId===child.id)throw Error('injected noble vacancy appointment');return id;};
   random.next=()=>{next.call(random);return calls++===0?.1:0;};try{Military.update(worldMonth,[team()],core.allCities);}finally{History.addEvent=writer;(Military as any).familyTransaction=transaction;random.next=next;}
   check(checkpoint&&diffCanonicalWorldSave(checkpoint,exportWorldSave(core)).matched&&Military.getDiagnostics().familyRecruitment.executionFailures===1,'bounded noble vacancy opportunity failure restores its entire User, family, army, history, sequence and RNG boundary');
   hydrateWorldSave(core,structuredClone(saved));Military.setHereditaryRecruitmentForSimulation('MEDIUM');calls=0;
   random.next=()=>{next.call(random);return calls++===0?.1:0;};try{Military.update(worldMonth,[team()],core.allCities);}finally{random.next=next;}
   const heir=team().getUserById(child.id),p=Military.getPerson(heir.militaryPersonId);
   check(calls===2&&p?.appointments.at(-1)?.officeHistory?.at(-1)?.office==='XIAOWEI'&&Military.getDiagnostics().familyRecruitment.titleAppointments===1,'one bounded national vacancy window selects one real titled civilian, then creates only its legitimate XIAOWEI command');strict();
  }
  hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'formal grant source and unique civilian title read without another award');
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return strict();};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'formal peerage and descendant life resume twelve months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second read preserves political-source inheritance and the same original residents');
 }finally{hydrateWorldSave(core,structuredClone(original));}
}
