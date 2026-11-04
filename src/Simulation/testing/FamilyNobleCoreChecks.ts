import {checkDualNobleSources} from './DualNobleSourceCoreChecks';
import FactionDetails from '../../UI/Components/FactionDetails';
import HistoryEntityNavigation from '../../UI/Components/HistoryScroll/HistoryEntityNavigation';
import {historyEntityLinks} from '../../History/HistoryEntityLinks';
import {formatHistoryEventTitle} from '../../History/HistoryRenderRules';
import {setTeams,setWorldMonth,setSelectedFactionName,setPersonArchiveRequest} from '../../store/rootSlice';
import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import MilitaryFamilyBrowser from '../../UI/Components/FactionDetails/MilitaryFamilyBrowser';
import {familyMemberNobleLabel} from '../../UI/Components/FactionDetails/FamilyNoblePanel';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Fork the already-created real military family and its actual natural-entry civilian child. */
export async function checkFamilyNobleCore(core:any,factionId:string,childId:number,check:(v:unknown,s:string)=>void){
 const original=exportWorldSave(core),team=()=>core.teams.find((t:any)=>t.name===factionId),family=()=>Military.getFamilies().find(f=>f.factionId===factionId)!;
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 const update=()=>Military.updateFamilyTitles(240,core.teams,Dynasty.getAll());
 try{
  update();check(!family().nobleSuccession?.length,'living founder neither retires his title nor gives an adult civilian child an early inheritance');
  {const before=exportWorldSave(core),f=family(),member=f.members.find(m=>m.sourceUserId===childId)!,host=document.createElement('div'),root=createRoot(host);document.body.append(host);
   try{flushSync(()=>root.render(React.createElement(Provider,{store,children:React.createElement(MilitaryFamilyBrowser,{families:[f],worldMonth:240,onClose:()=>{}})})));
    const dialog=document.querySelector('[role="dialog"]')!,open=Array.from(dialog.querySelectorAll('button')).find(b=>b.textContent?.includes('始祖'))!;flushSync(()=>open.click());
    check(!dialog.querySelector(`[data-family-member="${member.memberId}"]`)&&!dialog.querySelector('[data-family-summary]'),'ordinary descendant is omitted from main view without a summary placeholder or population deletion');
    check(!Array.from(dialog.querySelectorAll('button')).some(b=>b.textContent==='展开普通旁支'),'main family view has no ordinary-branch expansion button');
    const complete=Array.from(dialog.querySelectorAll('button')).find(b=>b.textContent==='完整族谱')!;flushSync(()=>complete.click());
    check(dialog.querySelector(`[data-family-member="${member.memberId}"]`)&&!dialog.querySelector(`[data-family-member="${member.memberId}"]`)?.textContent?.includes('无承袭爵位'),'complete genealogy shows the real civilian without repeated negative title labels');
    check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'omitting ordinary branches and opening full genealogy leave canonical population, titles, parent IDs and RNG identical');
   }finally{flushSync(()=>root.unmount());host.remove();}
  }
  const father=Military.getPerson(family().founderPersonId)!,resident=[...team().users].find((u:any)=>u.id===father.sourceUserId) as any;
  {const before=exportWorldSave(core),writer=History.addEvent;History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='military-person-died')throw Error('injected founder death write');return id;};let died:boolean;try{died=resident.destroyUser(false,{cause:'BATTLE_DEATH',month:240});}finally{History.addEvent=writer;}check(!died!&&diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'founder death source failure restores the live original User, family life, army, population, history and RNG');}
  clock(240);check(resident.destroyUser(false,{cause:'BATTLE_DEATH',month:240}),'actual founder death commits through User and military command cleanup');
  const death=exportWorldSave(core);check(validateWorldSave(death).valid,'committed real death is valid before a separate title-resolution transaction');
  for(const failure of ['family-title-succeeded','family-state']){
   hydrateWorldSave(core,structuredClone(death));const before=exportWorldSave(core),writer=History.addEvent,commit=Military.commitFamilyTitle;
   if(failure==='family-state')Military.commitFamilyTitle=function(...args){commit.apply(this,args);throw Error('injected family title state write');};
   else History.addEvent=function(e){const id=writer.call(this,e);if(e.type===failure)throw Error('injected family title event');return id;};
   try{update();}finally{History.addEvent=writer;Military.commitFamilyTitle=commit;}
   check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,`${failure} restores the entire title transaction, event IDs and RNG while retaining the already-committed death`);
  }
  hydrateWorldSave(core,structuredClone(death));{const before=exportWorldSave(core),u=team().getUserById(childId);team().users.delete(u);update();team().users.add(u);check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched&&Military.getDiagnostics().familyTitleIdentityRejected>0,'missing original heir population binding rejects the transaction without a half title or new entity');}
  hydrateWorldSave(core,structuredClone(death));const pop=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),people=Military.getPeople().length,formations=JSON.stringify(Military.getFormations());update();
  const f=family(),a=f.nobleSuccession?.at(-1),child=[...team().users].find((u:any)=>u.id===childId) as any;
  check(a?.kind==='SUCCEEDED'&&a.rank==='BO'&&f.members.find(m=>m.memberId===a.holderMemberId)?.sourceUserId===childId,'real marquis founder death leads to one direct-child baron inheritance');
  check(!child.militaryPersonId&&child.role==='NORMAL'&&Military.getPeople().length===people&&JSON.stringify(Military.getFormations())===formations&&core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===pop,'ordinary resident inherits only a title, without military identity, troops, population or royal office');
  check(familyMemberNobleLabel(f,f.members.find(m=>m.memberId===a!.holderMemberId)!,240)==='袭伯爵','family UI reads the real inherited baronage separately from a civilian military status');
  {const before=exportWorldSave(core),event=History.getRecordedEvents().find(e=>e.id===a!.eventId)!,member=f.members.find(m=>m.memberId===a!.holderMemberId)!,links=historyEntityLinks(event,Military.getFamilies(),Military.getPeople(),Dynasty.getAll(),new Set(core.teams.map((t:any)=>t.name)));
   check(links.some(l=>l.target.kind==='FAMILY'&&l.target.memberId===member.memberId)&&!links.some(l=>l.target.kind==='MILITARY'&&l.label.includes(member.name)),'ordinary inherited resident has a real family destination and no invented military archive');
   check(formatHistoryEventTitle(event,new Map(core.teams.map((t:any)=>[t.name,t]))).includes(team().displayName),'actual hereditary history uses the historical faction name without rewriting canonical title');
   const host=document.createElement('div'),root=createRoot(host);document.body.append(host);try{store.dispatch(setTeams(core.teams));store.dispatch(setWorldMonth({monthIndex:240,year:20}));store.dispatch(setSelectedFactionName(undefined));store.dispatch(setPersonArchiveRequest(undefined));flushSync(()=>root.render(React.createElement(Provider,{store,children:React.createElement(React.Fragment,null,React.createElement(HistoryEntityNavigation,{event}),React.createElement(FactionDetails))})));
    for(let wait=0;wait<100&&!Array.from(host.querySelectorAll('button')).some(b=>b.textContent===`定位${member.name}`);wait++)await new Promise(resolve=>setTimeout(resolve,10));
    const locate=Array.from(host.querySelectorAll('button')).find(b=>b.textContent===`定位${member.name}`)!;check(!!locate,'expanded actual hereditary event exposes its exact resident heir');flushSync(()=>locate.click());await new Promise(resolve=>setTimeout(resolve,180));flushSync(()=>{});
    const dialog=document.querySelector('[role="dialog"]');check(dialog?.querySelector(`[data-family-member-detail="${member.memberId}"]`)&&dialog.querySelector('[data-shared-genealogy]'),'real history click crosses Redux faction navigation into the exact family tree and selected ordinary resident');check(!child.militaryPersonId&&Military.getPeople().length===people,'history navigation does not manufacture a military person');
    const fit=Array.from(dialog!.querySelectorAll('button')).find(b=>b.textContent==='适应窗口')!;flushSync(()=>fit.click());const center=Array.from(dialog!.querySelectorAll('button')).find(b=>b.textContent==='定位始祖')!;flushSync(()=>center.click());check(dialog?.querySelector('[data-genealogy-focused]'),'shared viewport supports actual family fit and person location');check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'history links, shared viewport and civilian detail leave all canonical identities, army and RNG unchanged');
   }finally{flushSync(()=>root.unmount());host.remove();store.dispatch(setPersonArchiveRequest(undefined));}
  }
  const saved=exportWorldSave(core),v=validateWorldSave(saved);check(v.valid,`strict hereditary title save: ${v.errors.join(';')}`);update();check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'same monthly title update is idempotent');
  {const before=exportWorldSave(core),heir=team().getUserById(childId),pop=core.teams.reduce((n:number,t:any)=>n+t.users.size,0);check((Military as any).appoint(heir,factionId,240,[heir.player.logicalUnitId]),'actual inherited civilian can later receive a normal first military appointment');const p=Military.getPerson(heir.militaryPersonId)!;check(p.appointments.at(-1)?.officeHistory?.at(-1)?.office==='XIAOWEI'&&p.capturedEventIds.length===0&&!p.nobilityHistory&&familyMemberNobleLabel(family(),family().members.find(m=>m.sourceUserId===childId)!,240)==='袭伯爵','inherited baronage grants no higher office, personal military title or ancestral battle credits');check(core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===pop&&p.bornMonth===heir.bornMonth&&validateWorldSave(exportWorldSave(core)).valid,'civilian inheritance followed by real service preserves population, birth and strict family identity');checkDualNobleSources(core,childId,factionId,check);hydrateWorldSave(core,structuredClone(before));}
  for(const field of ['rank','holderMemberId','previousRank','step','sourceGrantEventId','death-boundary']){const bad=structuredClone(saved),f=bad.registries.militaryCommandRegistry.families!.find(f=>f.factionId===factionId)!,a=f.nobleSuccession![0];if(field==='death-boundary')f.members.find(m=>m.memberId===a.previousMemberId)!.deathHistoryIndex=(bad.worldHistory.events as unknown[]).length;else if(field==='step')a.step++;else (a as any)[field]='forged';check(!validateWorldSave(bad).valid,`strict inheritance rejects forged ${field}`);}
  {const before=exportWorldSave(core),writer=History.addEvent,u=team().getUserById(childId);History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='family-member-died')throw Error('injected civilian heir death source');return id;};let died:boolean;try{died=u.destroyUser(false,{cause:'BATTLE_DEATH',month:240});}finally{History.addEvent=writer;}check(!died!&&diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'ordinary titled resident death source failure restores life, title, population, actual map body and history');}
  hydrateWorldSave(core,structuredClone(saved));const heir=[...team().users].find((u:any)=>u.id===childId) as any;check(heir.destroyUser(false,{cause:'BATTLE_DEATH',month:240}),'actual civilian heir can die later in the same month');update();
  const same=exportWorldSave(core),sv=validateWorldSave(same);check(sv.valid&&family().nobleSuccession?.at(-1)?.reason==='NO_HEIR',`same-month later heir death closes its title without invalidating earlier living inheritance: ${sv.errors.join(';')}`);
  {const before=exportWorldSave(core),host=document.createElement('div'),root=createRoot(host);document.body.append(host);
   try{flushSync(()=>root.render(React.createElement(Provider,{store,children:React.createElement(MilitaryFamilyBrowser,{families:[family()],worldMonth:240,onClose:()=>{}})})));
    const dialog=document.querySelector('[role="dialog"]')!;
    check(!Array.from(dialog.querySelectorAll('button')).some(b=>b.textContent?.includes('始祖')),'actual extinct house leaves the default active overview without deleting its genealogy');
    const history=Array.from(dialog.querySelectorAll('button')).find(b=>b.textContent==='历史故家')!;flushSync(()=>history.click());const open=Array.from(dialog.querySelectorAll('button')).find(b=>b.textContent?.includes('始祖'))!;check(!!open,'actual historic house remains discoverable from historical houses');flushSync(()=>open.click());
    const cause=Array.from(dialog.querySelectorAll('summary')).find(n=>n.textContent==='原始史料与技术依据')!;flushSync(()=>{cause.parentElement!.setAttribute('open','');cause.parentElement!.dispatchEvent(new Event('toggle'));});await new Promise(r=>setTimeout(r,0));flushSync(()=>{});
    check(cause.parentElement?.textContent?.includes('没有已入籍、已登记的直接子嗣'),`actual committed no-heir result explains the contemporaneous direct-child evidence: ${cause.parentElement?.textContent}`);
    check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'historic-house classification and explanation do not change actual life, inheritance, family or RNG');
   }finally{flushSync(()=>root.unmount());host.remove();}
  }
  const final=family().nobleSuccession!.length;update();check(family().nobleSuccession!.length===final,'a broken chain does not seek newly generated children or recreate its title');
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let i=0;i<30;i++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
  const x=resume(),y=resume();check(validateWorldSave(x).valid&&diffCanonicalWorldSave(x,y).matched,'real inheritance deterministically continues twelve months without duplicate titles or changed RNG');hydrateWorldSave(core,structuredClone(x));check(diffCanonicalWorldSave(x,exportWorldSave(core)).matched,'second read preserves actual inherited civilian identity and title chain');
 }finally{hydrateWorldSave(core,structuredClone(original));}
}
