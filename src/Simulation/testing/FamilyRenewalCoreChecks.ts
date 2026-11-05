import {auditHouseFocusedRegistration} from './FamilyRegistrationAudit';
import {checkFamilyForfeiture} from './FamilyForfeitureCoreChecks';
import {familyNobleText} from '../../Politics/FamilyNobleSuccession';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import Military,{deriveUserBornMonth} from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {getLocalUserId} from '../../Live/LocalDanmaku';
import {deriveMilitaryLifeSchedule} from '../../Politics/MilitaryLifeRules';
import {familyAppointmentWeight} from '../../Politics/MilitaryFamily';
import {hereditaryAppointmentWeight} from '../../Politics/HereditaryRecruitment';
import {planFamilyPopulationEntry} from '../../Politics/MilitaryFamily';
import {explainFamilyTitleEnd} from '../../Politics/FamilyArchiveProjection';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
/** Existing real civilian creation; no preallocated child, invented User or overwritten birthday. */
function descendant(core:any,familyId:string,parentId:string,month:number,check:(v:unknown,s:string)=>void,needsService=false){
 const f=Military.getFamilies().find(f=>f.familyId===familyId)!,t=core.teams.find((t:any)=>t.name===f.factionId),population=core.simulator.population;
 while(t.users.size>=population.getCapacity(t)){const u=[...t.users].find((u:any)=>u.role==='NORMAL'&&!u.militaryPersonId&&!Military.getCommandForUnit(u.player.logicalUnitId??'')) as any;if(!u)throw Error('No safe real population slot');u.destroyUser(false,{cause:'GOD_ACTION',month});}
 let counter:number|undefined;
 for(let n=Math.max(1,(population.counters[f.factionId]??0)+1);n<20000;n++){const label=`${t.shortName??t.name}-${String(n).padStart(3,'0')}`,id=getLocalUserId(label),born=deriveUserBornMonth(id,label,f.factionId,month);if(core.teams.some((t:any)=>t.getUserById(id))||Military.getPeople().some(p=>p.sourceUserId===id)||Military.getFamilies().some(f=>f.members.some(m=>m.sourceUserId===id)))continue;const plan=planFamilyPopulationEntry(Military.getFamilies(),f.factionId,f.epochFounderId,id,born,month,String(random.exportState().seed));if(plan?.familyId===familyId&&plan.member.parentMemberId===parentId&&(!needsService||deriveMilitaryLifeSchedule({personId:Military.nextPersonId(),bornMonth:born}).retirementMonth>month+72)){counter=n;break;}}
 check(counter!==undefined,'a controlled actual natural-population entry can supply the specified legitimate direct child');if(counter===undefined)throw Error('No legitimate natural entry found');population.counters[f.factionId]=counter-1;return population.spawn(t,undefined,false,{cause:'NATURAL_GROWTH',month});
}
export function checkFamilyRenewalCore(core:any,heirId:number,factionId:string,check:(v:unknown,s:string)=>void){
 const original=exportWorldSave(core),clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false}),strict=()=>{const s=exportWorldSave(core),v=validateWorldSave(s);check(v.valid,`renewal/time strict save: ${v.errors.join(';')}`);return s;};
 try{
  Military.setFamilyNoblePolicyForSimulation('RENEWAL');const t=core.teams.find((t:any)=>t.name===factionId),u=t.getUserById(heirId),p=Military.getPerson(u.militaryPersonId)!,link=Military.getFamilyMember(u.id,u.bornMonth)!,familyId=link.family.familyId,memberId=link.member.memberId,base=p.appointments.at(-1)!.startMonth,command=p.appointments.at(-1)!.commandId,enemy=core.teams.find((e:any)=>e!==t&&e.status==='ACTIVE'),towns=t.cities.filter((c:any)=>c!==t.capitalCity&&!c.destroyed).slice(0,2);
  check(towns.length===2,'renewal uses two pre-existing cities and their real military capture transactions');
  for(const [i,c]of towns.entries()){const month=base+12*(i+1);clock(month);c.capture(enemy,month);u.player.setPosition(c.block.x,c.block.y);u.player.body.reset(u.player.x,u.player.y);const unit=core.logicalUnitRegistry.getEntry(u.player.logicalUnitId)!.state;unit.logicalX=c.block.x;unit.logicalY=c.block.y;c.capture(t,month,undefined,command,p.personId);}
  clock(base+60);Military.updateNobility(base+60,core.teams,Dynasty.getAll());const g=p.nobilityHistory?.find(g=>g.rank==='BO');check(g,'the descendant earns its own military BO by actual service and personal captures');if(!g)throw Error('Real descendant military BO not eligible');
  const childMonth=Math.max(base+72,Math.ceil((link.member.bornMonth+38*12)/12)*12);
  const before=strict(),oldActs=JSON.stringify(link.family.nobleSuccession),writer=History.addEvent;
  for(const mode of ['event','state']){const commit=Military.commitFamilyTitle;History.addEvent=function(e){const id=writer.call(this,e);if(mode==='event'&&e.type==='family-title-started'){random.next();throw Error('injected renewal history');};return id;};Military.commitFamilyTitle=function(...args){commit.apply(this,args);if(mode==='state'&&args[1].kind==='STARTED'){random.next();throw Error('injected renewal state');};};try{Military.updateFamilyTitles(base+60,core.teams,Dynasty.getAll());}finally{History.addEvent=writer;Military.commitFamilyTitle=commit;}check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,`${mode} failure rolls back the new hereditary period, source event, state, identities and RNG completely`);}
  Military.updateFamilyTitles(base+60,core.teams,Dynasty.getAll());const f=Military.getFamilies().find(f=>f.familyId===familyId)!,a=f.nobleSuccession!.at(-1)!;
  check(a.kind==='STARTED'&&a.period===2&&a.sourceGrantEventId===g.eventId&&a.rank==='BO'&&JSON.stringify(f.nobleSuccession!.slice(0,-1))===oldActs,'real personal BO starts one sourced second period from an ended or lower inherited period without rewriting prior acts');
  const opened=strict();if(f.nobleSuccession?.[0].kind==='ENDED')check(auditHouseFocusedRegistration(opened).recordedNewPeriodLineagesLost>0,'a focused registration cutoff would lose the actual late-entered descendant provenance of this genuinely reopened family; display optimization must retain that canonical relationship');if(f.nobleSuccession?.[0].kind==='SUCCEEDED')checkFamilyForfeiture(core,p.personId,familyId,check);
  {const resume=()=>{hydrateWorldSave(core,structuredClone(opened));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return strict();};const x=resume(),y=resume();check(diffCanonicalWorldSave(x,y).matched,'an actual second-period save resumes twelve months with identical RNG, persons, titles and original history');hydrateWorldSave(core,structuredClone(x));check(diffCanonicalWorldSave(x,exportWorldSave(core)).matched,'second read preserves new-period source and the single lawful holder');hydrateWorldSave(core,structuredClone(opened));}
  Military.updateFamilyTitles(base+60,core.teams,Dynasty.getAll());check(diffCanonicalWorldSave(opened,exportWorldSave(core)).matched,'new period source cannot be consumed twice');
  for(const altered of ['period','source','holder']){const forged=structuredClone(opened),act=forged.registries.militaryCommandRegistry.families!.find(f=>f.familyId===familyId)!.nobleSuccession!.at(-1)!;if(altered==='period')act.period=3;if(altered==='source')act.sourceGrantEventId=opened.registries.militaryCommandRegistry.families!.find(f=>f.familyId===familyId)!.nobleSuccession![0].sourceGrantEventId;if(altered==='holder')act.holderMemberId=act.previousMemberId+'-fake';(forged.worldHistory.events as import('../../History/WorldHistory').WorldEvent[]).find(e=>e.id===act.eventId)!.metadata!.familyNobleAct=JSON.stringify(act);check(!validateWorldSave(forged).valid,`strict replay rejects forged new-period ${altered}, even when its history echo is altered`);}
  // A child present before the death actually inherits from the second period.
  clock(childMonth);const child=descendant(core,familyId,memberId,childMonth,check),pop=core.teams.reduce((n:number,t:any)=>n+t.users.size,0);check(core.teams.find((t:any)=>t.name===factionId).getUserById(heirId).destroyUser(false,{cause:'BATTLE_DEATH',month:childMonth}),'new-period root dies through the authoritative military/User transaction');Military.updateFamilyTitles(childMonth,core.teams,Dynasty.getAll());const inherited=Military.getFamilies().find(f=>f.familyId===familyId)!.nobleSuccession!.at(-1)!;
  check(inherited.kind==='SUCCEEDED'&&inherited.period===2&&inherited.rank==='ZI'&&inherited.holderMemberId===child.familyMemberId&&!child.militaryPersonId&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===pop-1,'second period legally descends BO to one real registered civilian ZI, without a military identity, extra army or extra population');strict();
  // In a separate fork the same father has no registered child until after his death.
  hydrateWorldSave(core,structuredClone(opened));clock(childMonth);core.teams.find((t:any)=>t.name===factionId).getUserById(heirId).destroyUser(false,{cause:'BATTLE_DEATH',month:childMonth});Military.updateFamilyTitles(childMonth,core.teams,Dynasty.getAll());const ended=Military.getFamilies().find(f=>f.familyId===familyId)!.nobleSuccession!.at(-1)!;check(ended.kind==='ENDED'&&ended.reason==='NO_HEIR','actual second-period death without a currently registered child ends the period');const sealed=JSON.stringify(ended);
  clock(childMonth+12);const later=descendant(core,familyId,memberId,childMonth+12,check),f2=Military.getFamilies().find(f=>f.familyId===familyId)!,m=f2.members.find(m=>m.sourceUserId===later.id)!;Military.updateFamilyTitles(childMonth+12,core.teams,Dynasty.getAll());const x=explainFamilyTitleEnd(f2,ended,{month:childMonth+12,people:Military.getPeople(),events:History.getRecordedEvents(),dynasties:Dynasty.getAll()});
  check(m.bornMonth<childMonth&&m.enteredMonth===childMonth+12&&JSON.stringify(f2.nobleSuccession!.at(-1))===sealed&&x.laterChildren.some(c=>c.memberId===m.memberId),'real later adult entry may preserve an earlier birthday and father, but cannot rewrite the completed inheritance; explanation names its actual entry month');const lateSave=strict();
  for(const moveEntryMonth of [false,true]){const forged=structuredClone(lateSave),ff=forged.registries.militaryCommandRegistry.families!.find(f=>f.familyId===familyId)!,act=ff.nobleSuccession!.at(-1)!,events=forged.worldHistory.events as import('../../History/WorldHistory').WorldEvent[];
   act.kind='SUCCEEDED';act.reason='DEATH';act.holderMemberId=m.memberId;act.rank='ZI';const e=events.find(e=>e.id===act.eventId)!;e.type='family-title-succeeded';e.title=familyNobleText(ff,act);e.metadata!.memberId=m.memberId;e.metadata!.familyNobleAct=JSON.stringify(act);
   if(moveEntryMonth){ff.members.find(x=>x.memberId===m.memberId)!.enteredMonth=childMonth;const entry=events.find(e=>e.id===`${m.memberId}-entered`)!;entry.year=childMonth;entry.monthIndex=childMonth;}
   check(!validateWorldSave(forged).valid,moveEntryMonth?'strict replay rejects same-month backdating when actual entry source remains after the closed inheritance':'strict replay rejects assigning a future resident to an old inheritance even when the outcome and history echo agree');}

 }finally{hydrateWorldSave(core,structuredClone(original));}
}

/** The initial founder has actually died without a registered child; a later adult
 * earns its own new BO. This does not repair or rewrite the old no-heir result. */
export function checkLateFamilyRestartCore(core:any,familyId:string,check:(v:unknown,s:string)=>void){
 const original=exportWorldSave(core),clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  Military.setFamilyNoblePolicyForSimulation('RENEWAL');const f=Military.getFamilies().find(f=>f.familyId===familyId)!,month=Math.ceil(((f.nobleSuccession?.at(-1)?.month??0)+12)/12)*12;clock(month);
  const child=descendant(core,familyId,f.members[0].memberId,month,check,true),t=core.teams.find((t:any)=>t.name===f.factionId),before=JSON.stringify(f.nobleSuccession);
  Military.updateFamilyTitles(month,core.teams,Dynasty.getAll());check(JSON.stringify(Military.getFamilies().find(f=>f.familyId===familyId)!.nobleSuccession)===before,'later registration alone cannot restart a sealed original title');
  const candidates=[...t.users].filter((u:any)=>(Military as any).isEligible(u,month)).sort((a:any,b:any)=>a.id-b.id||a.name.localeCompare(b.name)) as any[],royals=(Military as any).royalService?.candidates(t,month)??[],index=candidates.indexOf(child),weights=candidates.map(u=>u.militaryPersonId?Military.getCareer(Military.getPerson(u.militaryPersonId)!,month).appointmentWeight:(()=>{const l=Military.getFamilyMember(u.id,u.bornMonth);return hereditaryAppointmentWeight(l?.family,l?.member,f.factionId,f.epochFounderId,month,familyAppointmentWeight(l?.family,l?.member,f.factionId,f.epochFounderId,month,(Military as any).royalService?.calibration?.()),'MEDIUM');})());
  check(index>=0,'the later real adult must pass the original normal appointment eligibility');
  const roll=(weights.slice(0,index).reduce((n,w)=>n+w,0)+weights[index]/2)/(weights.reduce((n,w)=>n+w,0)+royals.length),next=random.next;let calls=0;
  random.next=()=>{next.call(random);return calls++===0?0:roll;};try{Military.update(month,[t],core.allCities);}finally{random.next=next;}
  check(child.militaryPersonId&&Military.getPerson(child.militaryPersonId)?.appointments.at(-1)?.officeHistory?.[0].office==='XIAOWEI','later descendant obtains only a genuine initial XIAOWEI appointment through the shared national opportunity');
  checkFamilyRenewalCore(core,child.id,f.factionId,check);
 }finally{hydrateWorldSave(core,structuredClone(original));}
}
