import {militaryMilestones,selectMilitaryMilestones} from '../../Politics/MilitaryChroniclePresentation';
import {courtServiceReadings} from '../../Politics/CourtServicePresentation';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import MeritRoll from '../../UI/Components/FactionDetails/MeritRoll';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {selectCourtInstigator,courtAttemptChance} from '../../Politics/CourtCoup';
import {chooseCourtTarget} from '../../Politics/CourtCoupOutcome';
import {unresolvedCourtBans,planCourtPardon} from '../../Politics/MilitaryCourtStanding';
import {nextMilitaryHonors} from '../../Politics/MilitaryHonors';
import {currentNobleGrant} from '../../Politics/MilitaryNobility';
import {evaluateDepositionOpportunity,chooseDepositionClaimant} from '../../Politics/InReignDeposition';
import {getFactionStability} from '../../Components/City';
import {deriveMilitaryLifeSchedule} from '../../Politics/MilitaryLifeRules';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Production identity, commands, court outcome, sanction and pardon. Controlled rolls are not natural samples. */
export function checkCourtFates(core:any,base:ReturnType<typeof exportWorldSave>,factionId:string,check:(v:unknown,s:string)=>void,untitledBase:ReturnType<typeof exportWorldSave>){
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const team=()=>core.teams.find((t:any)=>t.name===factionId),dy=()=>Dynasty.get(factionId)!,king=()=>Dynasty.getCurrentRuler(factionId)!;
 const read=()=>{const v=validateWorldSave(exportWorldSave(core));check(v.valid,`court fate strict save: ${v.errors.join(';')}`);return exportWorldSave(core);};
 const opportunity=(m:number)=>evaluateDepositionOpportunity({factionId,status:team().status,identityStage:team().identityStage,cityCount:team().cities.length,stability:getFactionStability(team()),currentRuler:king(),rulers:dy().rulers,houseName:dy().houseName,worldMonth:m,events:History.getEventsForFaction(factionId)});
 const invoke=(m:number,roll:number)=>{const writer=random.next;random.next=()=>{writer.call(random);return roll;};try{(Dynasty as any).evaluateInReignDeposition(team(),dy(),king(),m);}finally{random.next=writer;}};
 function prepare(titled:boolean,strong:boolean,pardonGoal=false,noMilitaryMerits=false){
  hydrateWorldSave(core,structuredClone(noMilitaryMerits?untitledBase:base));clock(216);
  const t=team(),pos=t.capitalCity.block;for(const u of t.users){u.player.setPosition(pos.x+2,pos.y+2);u.player.body.reset(u.player.x,u.player.y);u.loyalty=0;}
  (Military as any).advanceOffices(216,core.teams);if(titled)Military.updateNobility(216,core.teams,Dynasty.getAll());clock(228);if(titled)Military.updateNobility(228,core.teams,Dynasty.getAll());
  if(strong){clock(240);(Military as any).advanceOffices(240,core.teams);}
  clock(251);const enemy=core.teams.find((x:any)=>x!==t&&x.status==='ACTIVE');t.capitalCity.capture(enemy,251);for(const c of t.cities)c.loyalty=20;clock(252);
  let e=opportunity(252),army=Military.getCourtAttemptInfluence(t,252,core.logicalUnitRegistry),actor=selectCourtInstigator(e,Military.getPeople(),army);
  if(pardonGoal){
   const old=king();let chosen=false;
   for(const c of army.candidates){const p=Military.getPerson(c.personId)!,body=t.getUserById(p.sourceUserId);if(!currentNobleGrant(p,factionId,252)||deriveMilitaryLifeSchedule(p).naturalDeathMonth<old.naturalDeathYear!+24)continue;
    for(let loyalty=0;loyalty<=100&&!chosen;loyalty++){
     for(const unit of t.users)if(unit.militaryPersonId)unit.loyalty=100;body.loyalty=loyalty;
     army=Military.getCourtAttemptInfluence(t,252,core.logicalUnitRegistry);actor=selectCourtInstigator(e,Military.getPeople(),army);const goal=actor&&chooseCourtTarget(e,actor,Military.getPerson(actor.personId)!);
     if(actor?.personId===p.personId&&goal&&dy().rulers.find(r=>r.id===goal.rulerId)!.naturalDeathYear!>old.naturalDeathYear!+24)chosen=true;
    }if(chosen)break;
   }check(chosen,'existing willing officer and an actual long-lived legal target support a later real pardon fixture');
  }
  check(actor,'real active military instigator exists');return {start:read(),actor:actor!,oldId:king().id};
 }
 try{
  hydrateWorldSave(core,structuredClone(base));const ordinary=Military.getPeople().find(p=>p.factionId===factionId&&p.status==='ACTIVE')!,body=team().getUserById(ordinary.sourceUserId);Military.endPersonCommands(ordinary.personId,216,'DISMISSED');
  check((Military as any).isEligible(body,216)&&(Military as any).appoint(body,factionId,216,[body.player.logicalUnitId]),'ordinary dismissal remains eligible for a real reappointment with the same existing User');
  for(const [titled,strong] of [[false,true],[true,false],[true,true]]){
   const fixture=prepare(titled,strong),roll=courtAttemptChance(fixture.actor)*.95;
   for(const failType of ['military-court-sanction',...(titled&&strong?['military-title-revoked']:[])]){
    hydrateWorldSave(core,structuredClone(fixture.start));const before=exportWorldSave(core),writer=History.addEvent;History.addEvent=function(e){const id=writer.call(this,e);if(e.type===failType)throw Error('injected court punishment write');return id;};try{invoke(252,roll);}finally{History.addEvent=writer;}
    check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,`${failType} fault restores people, titles, commands, history and RNG`);
   }
   hydrateWorldSave(core,structuredClone(fixture.start));invoke(252,roll);let p=Military.getPerson(fixture.actor.personId)!,user=team().getUserById(p.sourceUserId),ban=p.politicalHistory?.find(a=>a.kind==='COURT_BAN');
   check(ban&&p.status==='RETIRED'&&!((Military as any).isEligible(user,252))&&!((Military as any).appoint(user,factionId,252,[user.player.logicalUnitId])),'actual failed instigator is dismissed and cannot re-enter through either appointment entry');
   const revocations=p.honorHistory?.filter(h=>h.reason==='COURT_COUP_FAILED')??[];
   check(revocations.length===(titled&&strong?1:0),`actual ${strong?'major':'limited'} command and ${titled?'verified peerage':'no peerage'} produce only the applicable formal punishment`);
   check(dy().rulers.find(r=>r.id===fixture.oldId)?.status==='ruling'&&dy().rulers.filter(r=>r.id!==fixture.oldId).every(r=>!r.deathMonth||r.deathMonth<252),'unilaterally named royal target is neither punished nor killed');
   {const host=document.createElement('div'),root=createRoot(host),before=exportWorldSave(core);document.body.append(host);try{flushSync(()=>root.render(React.createElement(Provider,{store,children:React.createElement(MeritRoll,{factionId,month:252,onOpen:()=>{}})})));const card=host.querySelector(`[data-merit-person="${p.personId}"]`);check(card?.textContent?.includes('谋逆')&&(!revocations.length||card.textContent?.includes('追夺')),'actual React merit card retains real military achievements and clearly marks political disgrace and any formal forfeiture');check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'political status rendering does not change canonical people, army, history or RNG');}finally{root.unmount();host.remove();}}
   {const events=History.getRecordedEvents(),rows=militaryMilestones(p,Military.getChronicle(p,252),events),highlights=selectMilitaryMilestones(rows,events),coup=events.find(e=>e.id===ban!.courtCoupEventId)!;check(highlights.some(e=>e.eventId===coup.id)&&rows.filter(e=>e.sourceEventIds?.includes(coup.id)).length===1,'actual failed coup and its punishments enter highlights exactly once, preserving raw source IDs');}
   const saved=read(),bad=structuredClone(saved);delete bad.registries.militaryCommandRegistry.people.find(x=>x.personId===p.personId)!.politicalHistory;check(!validateWorldSave(bad).valid,'strict save rejects a failed coup whose lasting sanction was erased');
   for(const field of ['victimRulerId','rulerId','epochFounderId','courtCoupEventId']){const corrupt=structuredClone(saved),person=corrupt.registries.militaryCommandRegistry.people.find(x=>x.personId===p.personId)!,a=person.politicalHistory![0] as any;a[field]='forged';const event=(corrupt.worldHistory.events as import('../../History/WorldHistory').WorldEvent[]).find(e=>e.id===a.eventId)!;event.metadata!.courtAct=JSON.stringify(a);check(!validateWorldSave(corrupt).valid,`court sanction rejects forged ${field} even if its stored JSON is rewritten`);}
   if(titled&&strong){const corrupt=structuredClone(saved),person=corrupt.registries.militaryCommandRegistry.people.find(x=>x.personId===p.personId)!;person.honorHistory=person.honorHistory?.filter(h=>h.reason!=='COURT_COUP_FAILED');corrupt.worldHistory.events=(corrupt.worldHistory.events as import('../../History/WorldHistory').WorldEvent[]).filter(e=>!(e.type==='military-title-revoked'&&e.metadata?.personId===p.personId));check(!validateWorldSave(corrupt).valid,'strict court save rejects erasing both the required revocation and its history');}
   if(titled&&!strong){
    clock(264);user.destroyUser(false,{cause:'BATTLE_DEATH',month:264,damageSource:'HOSTILE_HOME_OCCUPATION'});p=Military.getPerson(p.personId)!;
    const events=History.getRecordedEvents(),control=nextMilitaryHonors({...p,politicalHistory:undefined},Military.getFormations(),events,264,core.teams,Dynasty.getAll());
    check(control.some(h=>h.kind==='POSTHUMOUS')&&!nextMilitaryHonors(p,Military.getFormations(),events,264,core.teams,Dynasty.getAll()).some(h=>h.kind==='POSTHUMOUS'),'military posthumous merits alone qualify, but the unresolved court ban stops praise by the same real monarch');
    Military.updateHonors(264,core.teams,Dynasty.getAll());check(!p.honorHistory?.some(h=>h.kind==='POSTHUMOUS'),'production posthumous writer does not invent a praising epithet after an unpardoned coup');read();
   }
   const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return read();};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'court sanctions and peerage survive a deterministic twelve-month continuation');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'court sanctions read again without identity drift');
  }
  {
   const max=prepare(true,true),person=Military.getPerson(max.actor.personId)!,command=person.appointments.at(-1)!.commandId;
   const lost=History.getRecordedEvents().filter(e=>e.type==='capital-fallen'&&e.targetFactionId===factionId&&e.year===251).at(-1)!,city=core.allCities.find((c:any)=>c.id===lost.cityId);clock(264);city.capture(team(),264,undefined,command,person.personId);
   for(const u of team().users){u.player.setPosition(team().capitalCity.block.x+2,team().capitalCity.block.y+2);u.player.body.reset(u.player.x,u.player.y);}clock(276);(Military as any).advanceOffices(276,core.teams);
   check(person.appointments.at(-1)?.officeHistory?.at(-1)?.office==='SHANGJIANGJUN','real new capture and original promotion rules produce an actual highest-rank officer');
   invoke(276,0);check(courtServiceReadings(person,History.getRecordedEvents(),276).length===1,'successful real supporter has one source-bound award reading, not an invented promotion');check(person.appointments.at(-1)?.officeHistory?.at(-1)?.office==='SHANGJIANGJUN','court reward never invents an office beyond the actual highest military rank');read();
  }
  {
   const f=prepare(false,true,false,true),id=f.actor.personId;
   for(const failure of ['court-peerage-granted','court-reward-granted']){
    hydrateWorldSave(core,structuredClone(f.start));const before=exportWorldSave(core),writer=History.addEvent;
    History.addEvent=function(e){const written=writer.call(this,e);if(e.type===failure)throw Error('injected political peerage write');return written;};
    try{invoke(252,0);}finally{History.addEvent=writer;}
    check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,`${failure} rolls back king, peerage, commands, history and RNG together`);
   }
   hydrateWorldSave(core,structuredClone(f.start));const reward=Military.rewardCourtService;let rewardIdentityStable=false;
   Military.rewardCourtService=function(...args){const population=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),people=Military.getPeople().length,commands=JSON.stringify(Military.getFormations());reward.apply(this,args);rewardIdentityStable=population===core.teams.reduce((n:number,t:any)=>n+t.users.size,0)&&people===Military.getPeople().length&&commands===JSON.stringify(Military.getFormations());};
   try{invoke(252,0);}finally{Military.rewardCourtService=reward;}
   const p=Military.getPerson(id)!,g=currentNobleGrant(p,factionId,252);
   check(g?.basis==='COURT'&&g.rank==='BO'&&g.captureEventIds.length===0&&g.serviceMonths===0,'a real untitled nonroyal supporter receives an independent foundational political BO without invented combat credit');
   check(rewardIdentityStable,'the actual political reward changes neither population, military identities nor commands; royal accession remains its separate existing transaction');
   check(courtServiceReadings(p,History.getRecordedEvents(),252).some(x=>x.text.includes('政治恩爵')),'actual political peerage appears in the supporter life reading');
   (Military as any).updateFamilies(252,core.teams);const family=Military.getFamilies().find(x=>x.founderPersonId===id);
   check(family&&family.sourceEventId===g?.courtServiceEventId,'the genuine court service establishes one family with a real political peerage source');
   const saved=read();hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'political peerage reads without repeating the award');
   for(const field of ['basis','courtServiceEventId','rank','serviceMonths']){const bad=structuredClone(saved),grant=bad.registries.militaryCommandRegistry.people.find(p=>p.personId===id)!.nobilityHistory!.find(g=>g.basis==='COURT')! as any;grant[field]=field==='rank'?'GONG':field==='serviceMonths'?60:'forged';const event=(bad.worldHistory.events as any[]).find(e=>e.id===grant.eventId);event.metadata.nobility=JSON.stringify(grant);check(!validateWorldSave(bad).valid,`political peerage rejects forged ${field} even with matching stored JSON`);}
  }
  const fixture=prepare(true,false,true);invoke(252,courtAttemptChance(fixture.actor)*.95);let p=Military.getPerson(fixture.actor.personId)!,ban=p.politicalHistory![0],old=king(),targetId=JSON.parse(String(History.getRecordedEvents().find(e=>e.id===ban.courtCoupEventId)!.metadata?.courtCoup)).targetRulerId;
  check(!planCourtPardon(p,team(),dy(),264,History.getRecordedEvents(),85),'victim still reigning never silently pardons his own attacker');
  clock(312);let e=opportunity(312);check(e.eligible===false,'old crisis expiration cannot authorize a fabricated later handoff');
  const enemy=core.teams.find((x:any)=>x!==team()&&x.status==='ACTIVE');clock(311);team().capitalCity.capture(enemy,311);clock(312);for(const c of team().cities)c.loyalty=20;e=opportunity(312);
  const selected=Array.from({length:200},(_,i)=>chooseDepositionClaimant(e,312,e.probability*(i+.5)/200)).find(s=>s?.claimant.ruler.id===targetId);check(selected,'actual original weighted royal selection can choose the earlier political goal');e.selection=selected!.evidence;e.militaryRoll=selected!.evidence.roll;
  check((Dynasty as any).commitDeposition(team(),dy(),old,selected!.claimant.ruler,selected!.claimant.relation,312,e),'a separate real legal handoff changes the sovereign, without pretending the earlier failed coup succeeded');
  check(unresolvedCourtBans(p,factionId,312).length===1&&!planCourtPardon(p,team(),dy(),312,History.getRecordedEvents(),85)&&!planCourtPardon(p,team(),dy(),324,History.getRecordedEvents(),20),'accession alone or an unstable new reign does not erase the original ban');
  const later=324;clock(later);p=Military.getPerson(p.personId)!;check(dy().rulers.find(r=>r.id===old.id)?.status==='deposed'&&dy().rulers.find(r=>r.id===old.id)?.deathMonth===undefined,'a real political handoff preserves the living former victim; no death is invented to grant mercy');
  for(const c of team().cities)c.loyalty=85;const act=planCourtPardon(p,team(),dy(),later,History.getRecordedEvents(),getFactionStability(team())??100);check(act,'a real stable new sovereign may pardon a still-living former supporter after the former victim lost political office');
  const prior=read(),writer=History.addEvent;History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='military-court-sanction')throw Error('injected pardon write');return id;};try{(Dynasty as any).evaluateCourtPardon(team(),dy(),later);}finally{History.addEvent=writer;}check(diffCanonicalWorldSave(prior,exportWorldSave(core)).matched,'pardon write failure restores the old ban and all canonical state');
  const forms=Military.getFormations().length,born=p.bornMonth,id=p.personId;(Dynasty as any).evaluateCourtPardon(team(),dy(),later);p=Military.getPerson(id)!;check(!unresolvedCourtBans(p,factionId,later).length&&p.status==='RETIRED'&&Military.getFormations().length===forms,'real pardon restores eligibility without an appointment, new person or army');
  const user=team().getUserById(p.sourceUserId);check((Military as any).appoint(user,factionId,later,[user.player.logicalUnitId])&&p.personId===id&&p.bornMonth===born,'existing appointment transaction resumes the same pardoned life and original birthday');read();
  {const es=History.getRecordedEvents(),rows=militaryMilestones(p,Military.getChronicle(p,later),es),selected=selectMilitaryMilestones(rows,es);check(selected.some(e=>es.find(x=>x.id===e.eventId)?.metadata?.courtAct&&JSON.parse(String(es.find(x=>x.id===e.eventId)!.metadata?.courtAct)).kind==='COURT_PARDONED'),'actual later pardon survives the selected military life instead of disappearing behind old promotions');}
  (Dynasty as any).evaluateCourtPardon(team(),dy(),later);check(p.politicalHistory!.filter(a=>a.kind==='COURT_PARDONED').length===1,'one ban receives at most one actual pardon');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
