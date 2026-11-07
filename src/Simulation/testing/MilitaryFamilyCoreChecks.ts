import {checkCrossRoyalKin} from './CrossRoyalKinCoreChecks';
import {PersonArchiveNavigation} from '../../UI/Components/FactionDetails/PersonArchiveNavigation';
import type {PersonArchiveTarget} from '../../UI/Components/FactionDetails/PersonArchiveTarget';
import {checkFamilyNobleCore} from './FamilyNobleCoreChecks';
import MilitaryFamilyBrowser from '../../UI/Components/FactionDetails/MilitaryFamilyBrowser';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import MilitaryFamilyPanel from '../../UI/Components/FactionDetails/MilitaryFamilyPanel';
import Military,{deriveUserBornMonth} from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {planFamilyPopulationEntry,familyAppointmentWeight} from '../../Politics/MilitaryFamily';
import {getLocalUserId} from '../../Live/LocalDanmaku';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import {nobleEpoch} from '../../Politics/MilitaryNobility';
/** All residents are produced by the actual population entry, all commands by the existing appointment. */
export async function checkMilitaryFamilies(core:any,base:ReturnType<typeof exportWorldSave>,factionId:string,check:(v:unknown,s:string)=>void){
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false}),team=()=>core.teams.find((t:any)=>t.name===factionId);
 const strict=()=>{const s=exportWorldSave(core),v=validateWorldSave(s);check(v.valid,`family strict save: ${v.errors.join(';')}`);return s;};
 try{
  hydrateWorldSave(core,structuredClone(base));clock(216);Military.updateNobility(216,core.teams,Dynasty.getAll());clock(228);Military.updateNobility(228,core.teams,Dynasty.getAll());
  const before=exportWorldSave(core),write=History.addEvent;History.addEvent=function(e){const id=write.call(this,e);if(e.type==='military-family-founded')throw Error('injected family charter write');return id;};try{Military.updateFamilies(228,core.teams,Dynasty.getAll());}finally{History.addEvent=write;}
  check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'failed family charter restores history and registry without extra population or RNG');
  Military.updateFamilies(228,core.teams,Dynasty.getAll());const family=Military.getFamilies().find(f=>f.factionId===factionId)!;check(family&&family.members.length===1,'real nonroyal marquis founds one sourced military family');Military.updateFamilies(228,core.teams,Dynasty.getAll());check(Military.getFamilies().filter(f=>f.founderPersonId===family.founderPersonId).length===1,'same merit and founder cannot found a second family');
  clock(240);const population=core.simulator.population;
  const full=exportWorldSave(core);check(!population.spawn(team(),undefined,false,{cause:'NATURAL_GROWTH',month:240})&&diffCanonicalWorldSave(full,exportWorldSave(core)).matched,'family population path honors the existing capacity gate without a draw or a hidden extra resident');
  while(team().users.size>=population.getCapacity(team())){const resident=[...team().users].find((u:any)=>u.role==='NORMAL'&&!u.militaryPersonId) as any;check(resident,'actual civilian exists for controlled population room');resident.destroyUser(false,{cause:'GOD_ACTION',month:240});}
  const epoch=nobleEpoch(Dynasty.get(factionId),240)?.foundingRulerId;let selected:number|undefined;
  for(let n=1;n<2000;n++){const label=`${team().shortName??team().name}-${String(n).padStart(3,'0')}`,id=getLocalUserId(label),born=deriveUserBornMonth(id,label,factionId,240);if(core.teams.some((t:any)=>t.getUserById(id))||240-born>40*12)continue;const plan=planFamilyPopulationEntry(Military.getFamilies(),factionId,epoch,id,born,240,String(random.exportState().seed));if(plan?.familyId===family.familyId){selected=n;break;}}
  check(selected!==undefined,'real adult entry birth plan admits a plausible father and child without re-aging');population.counters[factionId]=selected!-1;
  const ready=strict(),commit=Military.commitFamilyMember;Military.commitFamilyMember=function(plan){commit.call(this,plan);throw Error('injected family resident commit');};try{population.spawn(team(),undefined,false,{cause:'NATURAL_GROWTH',month:240});}finally{Military.commitFamilyMember=commit;}
  check(diffCanonicalWorldSave(ready,exportWorldSave(core)).matched,'family population entry failure restores User, logical unit, family, counters, audit and RNG');
  const historyWriter=History.addEvent;History.addEvent=function(e){const id=historyWriter.call(this,e);if(e.type==='military-family-member-entered')throw Error('injected population source write');return id;};try{population.spawn(team(),undefined,false,{cause:'NATURAL_GROWTH',month:240});}finally{History.addEvent=historyWriter;}
  check(diffCanonicalWorldSave(ready,exportWorldSave(core)).matched,'family original population event failure restores the resident, genealogy, history and RNG together');
  const count=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),people=Military.getPeople().length;
  const child=population.spawn(team(),undefined,false,{cause:'NATURAL_GROWTH',month:240});check(child&&child.familyMemberId,`actual natural population entry creates one named resident with frozen genealogy: result=${child?.name}/${child?.familyMemberId}; pop=${team().users.size}/${population.getCapacity(team())}; counter=${population.counters[factionId]}; expected=${selected}; families=${Military.getFamilies().length}`);
  const link=Military.getFamilyMember(child.id,child.bornMonth)!;
  check(link.member.parentMemberId===link.family.members[0].memberId&&link.member.bornMonth===child.bornMonth&&child.name===link.member.name&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===count+1&&Military.getPeople().length===people,'family relation is new-entry sourced, not an extra resident or an automatic military person');
  const civilianFamilySave=exportWorldSave(core);
  check(familyAppointmentWeight(link.family,link.member,factionId,epoch,240)===1.1,'the same eligible child receives bounded ten-percent first appointment weight');
  for(const p of Military.getPeople().filter(p=>p.factionId===factionId&&p.status==='ACTIVE'&&p.personId!==family.founderPersonId))Military.endPersonCommands(p.personId,240,'DISMISSED');
  check((Military as any).isEligible(child,240),'adult child passes every existing military entry condition');
  const appointmentBefore=exportWorldSave(core),appointmentWriter=History.addEvent;History.addEvent=function(e){const id=appointmentWriter.call(this,e);if(e.type==='military-office-granted'&&e.metadata?.personId===child.militaryPersonId)throw Error('injected descendant office write');return id;};
  let appointmentFailed=false;try{(Military as any).appoint(child,factionId,240,[child.player.logicalUnitId]);}catch{appointmentFailed=true;}finally{History.addEvent=appointmentWriter;}
  check(appointmentFailed&&diffCanonicalWorldSave(appointmentBefore,exportWorldSave(core)).matched,'descendant appointment failure restores User, family link, military person, command, original events and RNG');

  const candidates=[...team().users].filter((u:any)=>(Military as any).isEligible(u,240)).sort((a:any,b:any)=>a.id-b.id||a.name.localeCompare(b.name)) as any[];
  const weights=candidates.map(u=>{const p=u.militaryPersonId&&Military.getPerson(u.militaryPersonId),l=Military.getFamilyMember(u.id,u.bornMonth);return p?Military.getCareer(p,240).appointmentWeight:familyAppointmentWeight(l?.family,l?.member,factionId,epoch,240);});
  const royals=(Military as any).royalService?.candidates(team(),240)??[],index=candidates.indexOf(child),weightRoll=(weights.slice(0,index).reduce((n,w)=>n+w,0)+weights[index]/2)/(weights.reduce((n,w)=>n+w,0)+royals.length),next=random.next;let calls=0;
  random.next=()=>{next.call(random);return calls++===0?0:weightRoll;};try{Military.update(240,[team()],core.allCities);}finally{random.next=next;}
  check(calls===2&&child.militaryPersonId,'existing annual shared appointment draw selects the real child through its bounded family weight');
  check(Military.getPerson(child.militaryPersonId)!.personalName===child.name&&Military.getPerson(family.founderPersonId)!.status==='ACTIVE'&&link.member.militaryPersonId===child.militaryPersonId,'father and son serve simultaneously with distinct real military IDs and continuous births');
  check(!Military.getPerson(child.militaryPersonId)!.nobilityHistory&&Military.getFormations().find(f=>f.commanderPersonId===child.militaryPersonId)!.memberUnitIds.length===1,'descendant inherits no peerage, captures or extra troops');
  {let destination:PersonArchiveTarget|undefined;const before=exportWorldSave(core),host=document.createElement('div'),root=createRoot(host);document.body.append(host);
   try{flushSync(()=>root.render(React.createElement(Provider,{store,children:React.createElement(PersonArchiveNavigation.Provider,{value:{open:t=>{destination=t;},consume:()=>{},consumeGenealogy:()=>{}},children:React.createElement(MilitaryFamilyPanel,{personId:family.founderPersonId})})})));const details=host.querySelector('[data-military-family]') as HTMLDetailsElement;
    check(!!details&&!details.querySelector('details')&&!host.querySelector('[data-family-person-sources]'),'personal military archive keeps one compact family summary without the whole family, sources or relative list');
    const openFamily=Array.from(host.querySelectorAll('button')).find(b=>b.textContent===`查看${family.surname}氏宗谱`)!;check(!!openFamily,'actual military dossier retains its direct family entry');flushSync(()=>openFamily.click());
    check(destination?.kind==='FAMILY'&&destination.id===family.familyId&&destination.memberId===link.member.parentMemberId,'compact family reference navigates by the actual family and current member IDs');
    flushSync(()=>root.render(React.createElement(Provider,{store,children:React.createElement(PersonArchiveNavigation.Provider,{value:{open:t=>{destination=t;},consume:()=>{},consumeGenealogy:()=>{}},children:React.createElement(MilitaryFamilyBrowser,{families:[family],worldMonth:240,initialFamilyId:family.familyId,initialMemberId:link.member.parentMemberId,onClose:()=>root.render(null)})})})));
    const dialog=document.querySelector('[role="dialog"]')!;
    check(document.querySelectorAll('[role="dialog"]').length===1&&dialog.querySelector(`[data-family-member-detail="${link.member.parentMemberId}"]`),'family route focuses the actual current person in one shared modal');
    const children=dialog.querySelector(`[data-registered-children="${link.member.parentMemberId}"]`),childLink=children?.querySelector<HTMLButtonElement>(`button[data-family-child="${link.member.memberId}"]`);check(!!childLink&&children?.textContent?.includes(child.name),'actual selected parent exposes only its registered direct child and true name');flushSync(()=>childLink!.click());check(dialog.querySelector(`[data-family-member-detail="${link.member.memberId}"]`),'clicking the registered child selects the same permanent member in the shared tree');
    const returnParent=dialog.querySelector<HTMLButtonElement>(`[data-family-member="${link.member.parentMemberId}"] [data-genealogy-card]`)!;flushSync(()=>returnParent.click());
    const parentCard=dialog.querySelector(`[data-family-member="${link.member.parentMemberId}"]`)!;
    const archive=Array.from(parentCard.querySelectorAll('button')).find(b=>b.textContent==='人物档案')!;check(!!archive,'real military tree card exposes its own direct military archive button');flushSync(()=>archive.click());
    check(destination?.kind==='MILITARY'&&destination.id===family.founderPersonId&&destination.factionId===factionId,'family archive navigation targets the same permanent military identity and faction');
    await new Promise(resolve=>setTimeout(resolve,250));check(document.querySelectorAll('[role="dialog"]').length===0,'opening the real military archive closes the family modal instead of stacking dialogs');
    check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'family rendering changes no population, service, kinship or RNG');
   }finally{root.unmount();host.remove();}
  }
  {const before=strict(),host=document.createElement('div'),root=createRoot(host);document.body.append(host);
   try{flushSync(()=>root.render(React.createElement(Provider,{store,children:React.createElement(MilitaryFamilyBrowser,{families:[link.family],worldMonth:240,onClose:()=>{}})})));
    const dialog=document.querySelector('[role="dialog"]')!;check(dialog.textContent?.includes('功臣世家宗谱')&&!dialog.querySelector('[role="tree"]'),'family browser initially mounts only an overview, not every family tree');
    const open=Array.from(dialog.querySelectorAll('button')).find(b=>b.textContent?.includes('始祖'))!;flushSync(()=>open.click());
    check(!Array.from(dialog.querySelectorAll('button')).some(b=>['主干','完整族谱','收起该支','收起子支'].includes(b.textContent??'')),'one political family view has no full/trunk switch or per-person branch controls');
    check(dialog.querySelector('[role="tree"]')&&dialog.querySelector(`[data-family-parent="${link.member.parentMemberId}"][data-family-child="${link.member.memberId}"]`),'political family draws the actual father-son edge without synthesizing royal people');
    const card=dialog.querySelector(`[data-family-member="${link.member.memberId}"] button`) as HTMLButtonElement;flushSync(()=>card.click());check(dialog.querySelector('[data-family-member-detail]')?.textContent?.includes(child.name),'actual serving descendant still opens its own identity and military link');
    check(dialog.querySelector('[data-shared-genealogy]')&&dialog.querySelector('[data-genealogy-toolbar]')&&Array.from(dialog.querySelectorAll('button')).some(b=>b.textContent==='适应窗口'),'actual family uses the shared royal geometry, viewport and toolbar');
    check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'family total genealogy interaction preserves population, kinship, army, royal identities and RNG');
   }finally{flushSync(()=>root.unmount());host.remove();}
  }
  {const before=strict();Dynasty.setPoliticalCalibrationForSimulation('MEDIUM');const saved=strict();hydrateWorldSave(core,structuredClone(saved));check(Dynasty.getPoliticalCalibration()==='MEDIUM','saved future political and family policy survives hydration');const bad=structuredClone(saved);delete bad.registries.dynastyPoliticalCalibration;check(!validateWorldSave(bad).valid,'strict current save cannot omit its future political policy');hydrateWorldSave(core,structuredClone(before));}
  const save=strict();
  for(const kind of ['parent','birth','loop','person','death']){const bad=structuredClone(save),f=bad.registries.militaryCommandRegistry.families!.find(f=>f.familyId===family.familyId)!,m=f.members.find(m=>m.generation===1)!;if(kind==='parent')m.parentMemberId='foreign';if(kind==='birth')m.bornMonth--;if(kind==='loop')f.members[0].parentMemberId=m.memberId;if(kind==='person')m.militaryPersonId=f.founderPersonId;if(kind==='death')m.deathMonth=240;check(!validateWorldSave(bad).valid,`strict family save rejects forged ${kind}`);}
  const resume=()=>{hydrateWorldSave(core,structuredClone(save));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return strict();};const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'family relations and military appointments continue deterministically for twelve months');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'family second read preserves names, births, parent links, commands and RNG');
  hydrateWorldSave(core,structuredClone(civilianFamilySave));await checkFamilyNobleCore(core,factionId,child.id,check);await checkCrossRoyalKin(core,civilianFamilySave,family.familyId,child.id,check);
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
