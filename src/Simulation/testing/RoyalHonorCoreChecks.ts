import {militaryAmbition} from '../../Politics/MilitaryPoliticalDisposition';
import {selectCourtInstigator} from '../../Politics/CourtCoup';
import {evaluateDepositionOpportunity,chooseDepositionClaimant} from '../../Politics/InReignDeposition';
import {royalHonorCandidateClaims} from '../../Politics/RoyalHonors';
import {getFactionStability} from '../../Components/City';
import Factions from '../FactionRegistry';
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
/** Use an existing royal and the actual enlistment/capture path; titles never manufacture a career. */
function prepareMeritoriousRoyal(core:any,base:ReturnType<typeof exportWorldSave>,check:(v:unknown,s:string)=>void){
 let month=Math.ceil(base.world.worldMonth/12)*12,team:any,candidate:any;
 for(let offset=0;offset<=120&&!team;offset+=12){const m=month+offset;
  for(const t of core.teams){const d=Dynasty.get(t.name),king=Dynasty.getCurrentRuler(t.name);
   const c=Dynasty.getRoyalMilitaryCandidates(t,m).find(c=>{const r=d!.rulers.find(r=>r.id===c.rulerId)!;return militaryAmbition(Military.nextPersonId(),r.bornYear)>10&&m-r.bornYear>=288&&(r.naturalDeathYear??0)>m+72;});
   if(c&&king&&(king.naturalDeathYear??0)>m+72&&m-(king.accessionYear??m)>=12&&t.cities.length>=3&&core.allCities.some((c:any)=>c.ownerTeam!==t&&!c.destroyed)){team=t;candidate=c;month=m;break;}
  }
 }
 check(team,'an existing adult royal can serve under a real living sovereign');
 core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});
 for(const p of Military.getPeople().filter(p=>p.factionId===team.name&&p.status==='ACTIVE').slice(1))Military.endPersonCommands(p.personId,month,'DISMISSED');
 check(Dynasty.enlistRoyalMilitary(candidate,team,month,[]),'actual royal enlistment establishes its single audited military body');
 const r=Dynasty.get(team.name)!.rulers.find(r=>r.id===candidate.rulerId)!,p=Military.getPerson(r.militaryIdentity!.personId)!,command=p.appointments.at(-1)!.commandId;
 check(!planRoyalHonor({faction:team,dynasty:Dynasty.get(team.name)!,month,countryName:team.displayName,issuerTitle:Dynasty.getRulerTitleDisplay(team.name,month),people:Military.getPeople(),formations:Military.getFormations(),events:History.getEventsForFaction(team.name)}),'real military office alone never qualifies without a verified victory');
 const city=core.allCities.find((c:any)=>c.ownerTeam!==team&&!c.destroyed)!;
 if(city.ownerTeam.cities.length===1){const site=core.map.blocks.flat().find((b:any)=>!b.city&&core.allCities.every((c:any)=>Math.hypot(c.block.x-b.x,c.block.y-b.y)>96));check(site,'a distinct real spare city preserves the opposing polity');site.claimForTeam(city.ownerTeam);Factions.foundCity(city.ownerTeam,site,undefined,month);}
 month+=1;core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});city.capture(team,month,undefined,command,p.personId);
 month=Math.ceil((month+1)/12)*12;core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});
 check(planRoyalHonor({faction:team,dynasty:Dynasty.get(team.name)!,month,countryName:team.displayName,issuerTitle:Dynasty.getRulerTitleDisplay(team.name,month),people:Military.getPeople(),formations:Military.getFormations(),events:History.getEventsForFaction(team.name)}),'only a real royal commander with a source-linked captured city qualifies');
 return {month,team};
}
/** Existing live Core royals only; controlled calendar, real award and persistence transactions. */
export function checkRoyalHonors(core:any,base:ReturnType<typeof exportWorldSave>,check:(v:unknown,s:string)=>void){
 try{
  const prepared=prepareMeritoriousRoyal(core,base,check);let {month,team}=prepared;
  const factionId=team.name;core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});const before=exportWorldSave(core),writer=History.addEvent;
  History.addEvent=function(e){const id=writer.call(this,e);if(e.type==='royal-honor-granted')throw Error('injected honor write failure');return id;};
  try{check(!Dynasty.grantRoyalHonor(team,month),'injected award write fails before commit');}finally{History.addEvent=writer;}
  check(diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'award failure restores royal records, original history and RNG atomically');
  const rng=JSON.stringify(random.exportState()),count=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),commands=JSON.stringify(Military.getFormations()),heirs=JSON.stringify(Dynasty.get(factionId)?.heirIds),g=Dynasty.grantRoyalHonor(team,month);
  check(g&&g.recipientRulerId!==g.issuerRulerId,'real sovereign grants a distinct existing kinsman');
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{const r=Dynasty.get(factionId)!.rulers.find(r=>r.id===g!.recipientRulerId)!;flushSync(()=>root.render(React.createElement(RoyalHonorPanel,{ruler:r,month})));check(host.textContent?.includes(g!.recipientName)&&host.textContent.includes(g!.issuerTitle)&&host.textContent.includes(g!.eventId),'real React royal record displays the exact recipient, issuer and source act');}finally{root.unmount();host.remove();}
  check(JSON.stringify(random.exportState())===rng&&count===core.teams.reduce((n:number,t:any)=>n+t.users.size,0)&&commands===JSON.stringify(Military.getFormations())&&heirs===JSON.stringify(Dynasty.get(factionId)?.heirIds),'honor creates no RNG draw, population, army or change to normal heirs');
  const saved=exportWorldSave(core);check(validateWorldSave(saved).valid,'strict V38 accepts genuine honor and original kin');
  check(!Dynasty.grantRoyalHonor(team,month)&&History.getRecordedEvents().filter(e=>e.id===g!.eventId).length===1,'repeated update does not duplicate the title or event');
  for(const key of ['issuerRulerId','recipientRulerId','bornMonth','rank','epochFounderId']){const bad=structuredClone(saved),r=bad.dynasties.flatMap(d=>d.rulers as RulerSaveV17[]).find(r=>r.rulerId===g!.recipientRulerId)!,grant=r.royalHonors![0];(grant as any)[key]=key==='bornMonth'?grant.bornMonth-1:'forged';check(!validateWorldSave(bad).valid,`strict save rejects forged honor ${key}`);}
  const resume=(input=saved)=>{hydrateWorldSave(core,structuredClone(input));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
  const a=resume(),b=resume();check(diffCanonicalWorldSave(a,b).matched,'honor world resumes twelve months deterministically');hydrateWorldSave(core,structuredClone(a));check(diffCanonicalWorldSave(a,exportWorldSave(core)).matched,'second honor save reads without duplicate titles or kin');
  hydrateWorldSave(core,structuredClone(saved));team=core.teams.find((t:any)=>t.name===factionId)!;const imperialMonth=month+36;core.simulator.clock.importState({worldMonth:imperialMonth,elapsedMs:0,running:false});
  check(team.proclaimEmperor(imperialMonth),'existing formal state can enter the controlled imperial institution');History.addEmperorProclaimed(imperialMonth,team.name,team.displayName,Dynasty.getRulerDisplay(team.name),Dynasty.getCurrentRuler(team.name)!.id);
  const imperial=Dynasty.grantRoyalHonor(team,imperialMonth);check(!imperial,'imperial proclamation alone does not duplicate or upgrade a military merit honor');const empireSave=exportWorldSave(core);check(validateWorldSave(empireSave).valid,'strict V38 checks the actual imperial honor and proclamation source');
  const ea=resume(empireSave),eb=resume(empireSave);check(diffCanonicalWorldSave(ea,eb).matched,'imperial honor also continues deterministically for twelve months');hydrateWorldSave(core,structuredClone(ea));check(diffCanonicalWorldSave(ea,exportWorldSave(core)).matched,'imperial honor reads again without duplicate royal identities');

 }finally{hydrateWorldSave(core,structuredClone(base));}
}

export function checkRoyalHonorCompetition(core:any,base:ReturnType<typeof exportWorldSave>,check:(v:unknown,s:string)=>void){
 try{
  const prepared=prepareMeritoriousRoyal(core,base,check);let {month,team}=prepared;
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

/** A real royal officer contests personally; the exact existing body must become the crown. */
export function checkRoyalCourtAttempt(core:any,base:ReturnType<typeof exportWorldSave>,check:(v:unknown,s:string)=>void){
 try{
  const prepared=prepareMeritoriousRoyal(core,base,check),team=prepared.team,month=prepared.month+36;
  const g=Dynasty.grantRoyalHonor(team,prepared.month)!;check(g,'royal contender earned a real title before the coup');
  const d=Dynasty.get(team.name)!,r=d.rulers.find(r=>r.id===g.recipientRulerId)!,personId=r.militaryIdentity!.personId;
  for(const p of Military.getPeople().filter(p=>p.factionId===team.name&&p.status==='ACTIVE'&&p.personId!==personId))Military.endPersonCommands(p.personId,prepared.month,'DISMISSED');
  const enemy=core.teams.find((t:any)=>t!==team&&t.status==='ACTIVE')!;
  core.simulator.clock.importState({worldMonth:month-1,elapsedMs:0,running:false});team.capitalCity.capture(enemy,month-1);team.cities.forEach((c:any)=>c.loyalty=20);
  core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});const u=[...team.users].find((u:any)=>u.militaryPersonId===personId) as any;
  for(const unit of [...team.users] as any[]){unit.player.setPosition(team.capitalCity.block.x+2,team.capitalCity.block.y+2);unit.player.body.reset(unit.player.x,unit.player.y);}
  u.loyalty=0;(Military as any).advanceOffices(month,core.teams);
  const old=Dynasty.getCurrentRuler(team.name)!,e=evaluateDepositionOpportunity({factionId:team.name,status:team.status,identityStage:team.identityStage,cityCount:team.cities.length,stability:getFactionStability(team),currentRuler:old,rulers:d.rulers,houseName:d.houseName,worldMonth:month,events:History.getEventsForFaction(team.name),military:Military.getPoliticalInfluence(team,month,core.logicalUnitRegistry)});
  e.royalMilitaryClaims=Military.getRoyalDepositionClaims(team,month,e.candidates.map(c=>c.ruler),core.logicalUnitRegistry);e.royalHonorClaims=royalHonorCandidateClaims(d,month,team.sovereigntyRank);
  check(selectCourtInstigator(e,Military.getPeople())?.personId===personId,'the actual royal officer is the qualified instigator with real recruited followers');
  const roll=Array.from({length:100},(_,i)=>e.probability*(i+.5)/100).find(roll=>chooseDepositionClaimant(e,month,roll)?.claimant.ruler.id===r.id);check(roll!==undefined,'the existing weighted selection can genuinely select the royal instigator');
  const pop=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),born=u.bornMonth,userId=u.id,death=r.naturalDeathYear,writer=random.next;
  let draws=0;random.next=()=>{draws++;writer.call(random);return roll!;};try{(Dynasty as any).evaluateInReignDeposition(team,d,old,month);}finally{random.next=writer;}
  check(draws===1&&Dynasty.getCurrentRuler(team.name)?.id===r.id,'royal instigator wins the original one shared political draw');
  check(team.rulerUser===u&&u.id===userId&&u.bornMonth===born&&r.naturalDeathYear===death&&pop===core.teams.reduce((n:number,t:any)=>n+t.users.size,0),'royal winner reuses the exact same body, birth, lifespan and population');
  check(Military.getFormations().filter(f=>f.commanderPersonId===personId).every(f=>f.status==='DISBANDED'),'royal winner releases the former command without duplicating authority');
  const saved=exportWorldSave(core),v=validateWorldSave(saved);check(v.valid,`royal personal contest strictly saves: ${v.errors.join(';')}`);hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'royal personal contest reads without identity drift');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
