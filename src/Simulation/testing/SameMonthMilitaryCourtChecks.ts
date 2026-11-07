import React from 'react';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import MilitaryDetailProjection from '../../UI/Components/FactionDetails/MilitaryDetailProjection';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import rng from '../WorldRandom';
import {getFactionStability} from '../../Components/City';
import {evaluateDepositionOpportunity} from '../../Politics/InReignDeposition';
import {selectCourtInstigator,courtAttemptChance} from '../../Politics/CourtCoup';
import {militaryMilestones,selectMilitaryMilestones} from '../../Politics/MilitaryChroniclePresentation';
import {militaryChronicleReadingOrder} from '../../Politics/MilitaryChronicleOrder';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
/** Controlled production transaction, not a replay of the user's unsupplied world. */
export function checkSameMonthMilitaryCourt(core:any,base:ReturnType<typeof exportWorldSave>,factionId:string,check:(v:unknown,s:string)=>void){
 try{
  hydrateWorldSave(core,structuredClone(base));const month=240,clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
  clock(216);(Military as any).advanceOffices(216,core.teams);
  const t=core.teams.find((t:any)=>t.name===factionId);
  // Preserve the real capital-loss crisis used by the existing court production tests.
  const opponent=core.teams.find((other:any)=>other!==t&&other.status==='ACTIVE');clock(239);t.capitalCity.capture(opponent,239);clock(month);
  t.cities.forEach((c:any)=>c.loyalty=20);const center=t.capitalCity.block;
  for(const u of t.users){u.player.setPosition(center.x+2,center.y+2);u.player.body.reset(u.player.x,u.player.y);if(u.militaryPersonId)u.loyalty=0;}
  (Military as any).advanceOffices(month,core.teams);
  const d=Dynasty.get(factionId)!,king=Dynasty.getCurrentRuler(factionId)!,e=evaluateDepositionOpportunity({factionId,status:t.status,identityStage:t.identityStage,cityCount:t.cities.length,stability:getFactionStability(t),currentRuler:king,rulers:d.rulers,houseName:d.houseName,worldMonth:month,events:History.getEventsForFaction(factionId),military:Military.getPoliticalInfluence(t,month,core.logicalUnitRegistry)});
  e.royalMilitaryClaims=Military.getRoyalDepositionClaims(t,month,e.candidates.map(c=>c.ruler),core.logicalUnitRegistry);
  const actor=selectCourtInstigator(e,Military.getPeople(),Military.getCourtAttemptInfluence(t,month,core.logicalUnitRegistry),Dynasty.getAbilityPolicy());check(actor,'real same-month crisis has a lawful military instigator');if(!actor)return;
  let p=Military.getPerson(actor.personId)!;const promotion=p.appointments.flatMap(a=>a.officeHistory??[]).find(g=>g.month===month&&g.office==='JIANGJUN');check(promotion,'actual captures and service produce a general promotion before the court action');
  const roll=courtAttemptChance(actor,'MEDIUM',Dynasty.getAbilityPolicy())*.95,next=rng.next;rng.next=()=>{next.call(rng);return roll;};
  try{(Dynasty as any).evaluateInReignDeposition(t,d,king,month);}finally{rng.next=next;}
  p=Military.getPerson(actor.personId)!;const events=History.getRecordedEvents(),attempt=events.find(x=>x.type==='court-coup-attempt'&&x.metadata?.personId===p.personId&&(x.monthIndex??x.year)===month),ban=p.politicalHistory?.find(a=>a.kind==='COURT_BAN'&&a.month===month);
  check(attempt&&ban,'actual same-month attempt fails and commits its real sanction');if(!attempt||!ban||!promotion)return;
  const proof=JSON.parse(String(attempt.metadata?.courtCoup));check(proof.participant.officeStanding.office==='JIANGJUN','court candidate uses the actually promoted general office');
  const pos=(id:string)=>events.findIndex(e=>e.id===id),end=events.find(x=>x.type==='military-command-ended'&&x.metadata?.courtCoupEventId===attempt.id);
  check(pos(promotion.eventId)>=0&&pos(promotion.eventId)<pos(attempt.id)&&end&&pos(attempt.id)<pos(end.id),'canonical write order is promotion then court attempt then real command dismissal');
  const original=exportWorldSave(core),full=militaryChronicleReadingOrder(Military.getChronicle(p,month),events),rows=militaryMilestones(p,full,events),highlights=selectMilitaryMilestones(rows,events,rows.length);
  for(const reading of[full,rows,highlights])check(reading.findIndex(e=>e.eventId===promotion.eventId)>=0&&reading.findIndex(e=>e.eventId===promotion.eventId)<reading.findIndex(e=>e.eventId===attempt.id),'full biography and highlights preserve actual same-month order, not event ID order');
  const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
  try{flushSync(()=>root.render(React.createElement(MilitaryDetailProjection,{person:p,factionId,month,events,dynasties:Dynasty.getAll(),formations:Military.getFormations(),factions:new Map<string,import('../../Components/Team').default>(core.teams.map((t:any)=>[t.name,t])),children:view=>React.createElement('div',null,...view.allMilestones.map(e=>React.createElement('p',{'data-order-event':e.eventId,key:e.eventId},e.text)))})));const ids=Array.from(host.querySelectorAll('[data-order-event]')).map(n=>n.getAttribute('data-order-event'));check(ids.indexOf(promotion.eventId)>=0&&ids.indexOf(promotion.eventId)<ids.indexOf(attempt.id),'actual military detail React projection renders same-month promotion before court narrative');}finally{flushSync(()=>root.unmount());host.remove();}
  check(diffCanonicalWorldSave(original,exportWorldSave(core)).matched,'reading same-month history changes no canonical state or RNG');
  const offices=JSON.stringify(p.appointments),commands=Military.getFormations().filter(f=>f.commanderPersonId===p.personId);clock(252);(Military as any).advanceOffices(252,core.teams);
  check(JSON.stringify(Military.getPerson(p.personId)!.appointments)===offices&&commands.every(f=>f.status!=='ACTIVE'),'dismissed/banned or executed officer cannot promote or retain command without reappointment');
  const saved=exportWorldSave(core);check(validateWorldSave(saved).valid,'same-month promotion/coup/dismissal survives strict save');hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'same-month history preserves permanent identity and order after hydration');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
