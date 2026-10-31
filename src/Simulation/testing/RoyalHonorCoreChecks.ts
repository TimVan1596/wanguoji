import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import RoyalHonorPanel from '../../UI/Components/FactionDetails/RoyalHonorPanel';
import type {WorldEvent} from '../../History/WorldHistory';
import Dynasty from '../../Politics/Dynasty';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {planRoyalHonor} from '../../Politics/RoyalHonors';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave,type RulerSaveV17} from '../../Persistence/WorldSaveSchema';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
/** Existing live Core royals only; controlled calendar, real award and persistence transactions. */
export function checkRoyalHonors(core:any,base:ReturnType<typeof exportWorldSave>,check:(v:unknown,s:string)=>void){
 try{
  let month=base.world.worldMonth,team:any;
  for(let offset=0;offset<=60&&!team;offset+=12){month=base.world.worldMonth+offset;team=core.teams.find((t:any)=>{const d=Dynasty.get(t.name);return d&&(Dynasty.getCurrentRuler(t.name)?.naturalDeathYear??0)>month+48&&planRoyalHonor({faction:t,dynasty:d,month,countryName:t.displayName,issuerTitle:Dynasty.getRulerTitleDisplay(t.name,month),people:Military.getPeople(),formations:Military.getFormations(),events:History.getEventsForFaction(t.name)});});}
  check(team,'real existing adult royal qualifies without adding any kin');
  const factionId=team.name;core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});const before=exportWorldSave(core),writer=History.addEvent;
  History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='royal-honor-granted')throw Error('injected honor write failure');return id;};
  try{check(!Dynasty.grantRoyalHonor(team,month),'injected award write fails before commit');}finally{History.addEvent=writer;}
  check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'award failure restores royal records, original history and RNG atomically');
  const rng=JSON.stringify(random.exportState()),count=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),commands=JSON.stringify(Military.getFormations()),heirs=JSON.stringify(Dynasty.get(factionId)?.heirIds),g=Dynasty.grantRoyalHonor(team,month);
  check(g&&g.recipientRulerId!==g.issuerRulerId,'real sovereign grants a distinct existing kinsman');
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{const r=Dynasty.get(factionId)!.rulers.find(r=>r.id===g!.recipientRulerId)!;flushSync(()=>root.render(React.createElement(RoyalHonorPanel,{ruler:r,month})));check(host.textContent?.includes(g!.recipientName)&&host.textContent.includes(g!.issuerTitle)&&host.textContent.includes(g!.eventId),'real React royal record displays the exact recipient, issuer and source act');}finally{root.unmount();host.remove();}
  check(JSON.stringify(random.exportState())===rng&&count===core.teams.reduce((n:number,t:any)=>n+t.users.size,0)&&commands===JSON.stringify(Military.getFormations())&&heirs===JSON.stringify(Dynasty.get(factionId)?.heirIds),'honor creates no RNG draw, population, army or change to normal heirs');
  const saved=exportWorldSave(core);check(validateWorldSave(saved).valid,'strict V37 accepts genuine honor and original kin');
  check(!Dynasty.grantRoyalHonor(team,month)&&History.getRecordedEvents().filter(e=>e.id===g!.eventId).length===1,'repeated update does not duplicate the title or event');
  for(const key of ['issuerRulerId','recipientRulerId','bornMonth','rank','epochFounderId']){const bad=structuredClone(saved),r=bad.dynasties.flatMap(d=>d.rulers as RulerSaveV17[]).find(r=>r.rulerId===g!.recipientRulerId)!,grant=r.royalHonors![0];(grant as any)[key]=key==='bornMonth'?grant.bornMonth-1:'forged';check(!validateWorldSave(bad).valid,`strict save rejects forged honor ${key}`);}
  const resume=(input=saved)=>{hydrateWorldSave(core,structuredClone(input));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
  const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'honor world resumes twelve months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second honor save reads without duplicate titles or kin');
  hydrateWorldSave(core,structuredClone(saved));team=core.teams.find((t:any)=>t.name===factionId)!;const imperialMonth=month+36;core.simulator.clock.importState({worldMonth:imperialMonth,elapsedMs:0,running:false});
  check(team.proclaimEmperor(imperialMonth),'existing formal state can enter the controlled imperial institution');History.addEmperorProclaimed(imperialMonth,team.name,team.displayName,Dynasty.getRulerDisplay(team.name),Dynasty.getCurrentRuler(team.name)!.id);
  const imperial=Dynasty.grantRoyalHonor(team,imperialMonth);check(imperial?.rank==='QINWANG','only the actual imperial sovereign grants a real royal princely honor');const empireSave=exportWorldSave(core);check(validateWorldSave(empireSave).valid,'strict V37 checks the actual imperial honor and proclamation source');
  const ea=resume(empireSave),eb=resume(empireSave);check(diffCanonicalWorldSave(ea,eb).matched,'imperial honor also continues deterministically for twelve months');hydrateWorldSave(core,structuredClone(ea));check(diffCanonicalWorldSave(ea,exportWorldSave(core)).matched,'imperial honor reads again without duplicate royal identities');

 }finally{hydrateWorldSave(core,structuredClone(base));}
}

export function checkRoyalHonorCompetition(core:any,base:ReturnType<typeof exportWorldSave>,check:(v:unknown,s:string)=>void){
 try{
  let month=base.world.worldMonth,team:any;
  for(let offset=0;offset<=120&&!team;offset+=12){month=base.world.worldMonth+offset;team=core.teams.find((t:any)=>{const d=Dynasty.get(t.name),r=d&&Dynasty.getCurrentRuler(t.name);return t.cities.length>=3&&r&&(r.naturalDeathYear??Infinity)>month+24&&d&&planRoyalHonor({faction:t,dynasty:d,month,countryName:t.displayName,issuerTitle:Dynasty.getRulerTitleDisplay(t.name,month),people:Military.getPeople(),formations:Military.getFormations(),events:History.getEventsForFaction(t.name)});});}
  check(team,'existing multi-city kingdom has a real adult honor contender');
  core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});const grant=Dynasty.grantRoyalHonor(team,month)!;check(grant,'real claimant honor commits before the political crisis');
  const old=Dynasty.getCurrentRuler(team.name)!,enemy=core.teams.find((t:any)=>t!==team&&t.status==='ACTIVE')!,capital=team.capitalCity;
  core.simulator.clock.importState({worldMonth:month+11,elapsedMs:0,running:false});capital.capture(enemy,month+11);for(const c of team.cities)c.loyalty=20;
  month+=12;core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});const writer=random.next;
  random.next=()=>{writer.call(random);return 0;};try{(Dynasty as any).evaluateInReignDeposition(team,Dynasty.get(team.name),old,month);}finally{random.next=writer;}
  const event=History.getRecordedEvents().filter(e=>e.type==='ruler-deposed'&&e.actorFactionId===team.name).at(-1);
  check(event,'actual capital loss enters the original successful deposition transaction');const selection=JSON.parse(String(event!.metadata?.depositionSelection));
  check(selection.version===4&&selection.candidates.some((c:any)=>c.royalHonor?.eventId===grant.eventId&&c.honorAdvantage===.06),'real deposition retains the original honor source and bounded candidate weight');
  check(selection.candidates.every((c:any)=>c.weight<=c.baseWeight*1.500000000001),'honor, real command and actual support stay within the aggregate ceiling');
  const saved=exportWorldSave(core);check(validateWorldSave(saved).valid,'strict save verifies the real honored deposition after accession');
  const corrupt=structuredClone(saved),raw=(corrupt.worldHistory.events as WorldEvent[]).find(e=>e.id===event!.id)!;const bad=JSON.parse(String(raw.metadata?.depositionSelection));bad.candidates.find((c:any)=>c.royalHonor).royalHonor.eventId='invented';raw.metadata!.depositionSelection=JSON.stringify(bad);check(!validateWorldSave(corrupt).valid,'rewriting a candidate honor reference is rejected without weakening military identity checks');
  hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);const continued=exportWorldSave(core);hydrateWorldSave(core,structuredClone(continued));check(diffCanonicalWorldSave(continued,exportWorldSave(core)).matched,'honored successor, old command and original grants survive twelve months and another read');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
