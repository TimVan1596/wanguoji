import {civilCrossCareerEvidence,civilPromotionCompetitionWeight} from '../../Politics/CrossCareerCompetition';
import {civilPromotionEvidence} from '../../Politics/CivilPromotion';
import random from '../WorldRandom';
import {governorProfile,GovernorDetail} from '../../UI/Components/CivilAdministration/CivilGovernancePanel';
import {personAbilities,personAmbition,rulerAbilities} from '../../Politics/PersonAbilities';
import {Provider} from 'react-redux';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import Factions from '../FactionRegistry';
import Military from '../../Politics/MilitaryCommandRegistry';
import Civil,{civilGovernorCandidates,eligibleCivilCities} from '../../Politics/CivilAdministration';
import type {CivilGovernorTerm} from '../../Politics/CivilAdministrationSchema';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import {residentNaturalDeathMonth} from '../ResidentLife';
import {deriveMilitaryLifeSchedule} from '../../Politics/MilitaryLifeRules';
import {isPopulationIdentityLabel} from '../../Politics/MilitaryPersonIdentity';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
import FactionDetails from '../../UI/Components/FactionDetails';
import {store} from '../../store';
import {setFactionDetailTab,setSelectedFactionName,setTeams,setWorldMonth} from '../../store/rootSlice';
/** Directed production-path checks, not evidence of natural transfer frequency. */
export function checkCivilCareer(core:any,saved:WorldSaveV1,term:CivilGovernorTerm,check:(value:unknown,label:string)=>void){
 const clock=(month:number)=>core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});
 const strict=()=>exportWorldSave(core),reset=()=>hydrateWorldSave(core,structuredClone(saved));
 reset();
 check(!isPopulationIdentityLabel(term.personalName),'first civilian appointment freezes a natural full name');
 const team=()=>core.teams.find((t:any)=>t.name===term.factionId),user=()=>team().getUserById(term.sourceUserId);
 check(!(Military as any).appoint(user(),term.factionId,saved.world.worldMonth,[user().player.logicalUnitId]),'active governor cannot simultaneously acquire a military command');
 const end=saved.world.worldMonth+1;clock(end);
 let city=core.allCities.find((c:any)=>c.id===term.cityId);const enemy=core.teams.find((t:any)=>t.name!==term.factionId&&t.status==='ACTIVE');
 city.capture(enemy,end);Civil.update(end,core.teams,Dynasty.getAll());
 for(const formation of Military.getFormations().filter(f=>f.status==='ACTIVE'&&f.factionId===term.factionId))Military.endPersonCommands(formation.commanderPersonId,end,'DISMISSED');
 {
  const transferBase=strict(),annual=Math.ceil(end/12)*12,draw=random.next;let ticket:{roll:number;phase:number}|undefined;
  Military.setAppointmentObserverForSimulation((sample:any)=>{if(sample.factionId!==term.factionId){ticket=undefined;return;}if(!sample.rows)return;const rows=sample.rows,index=rows.findIndex((r:any)=>r.sourceUserId===term.sourceUserId&&r.bornMonth===term.bornMonth);if(index>=0){const total=rows.reduce((n:number,r:any)=>n+r.weight,0),left=rows.slice(0,index).reduce((n:number,r:any)=>n+r.weight,0);ticket={roll:(left+rows[index].weight/2)/total,phase:0};}});
  random.next=function(){const actual=draw.call(this);if(!ticket||ticket.phase>=2)return actual;return ticket.phase++===0?0:ticket.roll;};
  try{clock(annual);Military.update(annual,core.teams,core.allCities);const appointed=Military.getPerson(term.personId)!,selection=appointed.appointments[0]?.selection;
   check(selection&&selection.rows[selection.selectedIndex].firstAppointment&&appointed.appointments[0].officeHistory?.[0].office==='XIAOWEI','real shared annual military selection treats a civil-only person as initial xiaowei rather than military reappointment');
   const annualSave=strict();hydrateWorldSave(core,structuredClone(annualSave));check(diffCanonicalWorldSave(annualSave,strict()).matched,'actual annual civil-to-military selection and complete candidate evidence strictly replay');
  }finally{random.next=draw;Military.setAppointmentObserverForSimulation(undefined);hydrateWorldSave(core,structuredClone(transferBase));city=core.allCities.find((c:any)=>c.id===term.cityId);}
 }
 const before=strict(),write=History.addEvent;
 let threw=false;History.addEvent=function(e){const id=write.call(this,e);if(e.type==='military-appointment')throw Error('injected civil-to-military write');return id;};
 try{(Military as any).appoint(user(),term.factionId,end,[user().player.logicalUnitId]);}catch{threw=true;}finally{History.addEvent=write;}
 check(threw&&diffCanonicalWorldSave(before,strict()).matched,'failed civil-to-military appointment restores population, identity, history, sequences and formations');
 check((Military as any).appoint(user(),term.factionId,end,[user().player.logicalUnitId]),'former governor passes existing military qualification and initial command creation');
 const person=()=>Military.getPerson(term.personId)!;
 check(person().personalName===term.personalName&&person().bornMonth===term.bornMonth&&person().sourceUserId===term.sourceUserId&&person().appointments.at(-1)?.officeHistory?.[0]?.office==='XIAOWEI','civilian enters as the same person and initial xiaowei');
 check(deriveMilitaryLifeSchedule(person()).naturalDeathMonth===residentNaturalDeathMonth(term.sourceUserId,term.bornMonth),'civil-to-military transfer preserves the original resident natural lifespan');
 user().player.setPosition(city.block.x,city.block.y);user().player.Body.reset(user().player.x,user().player.y);
 city.capture(team(),end,undefined,person().appointments.at(-1)!.commandId,term.personId);
 const awardMonth=Math.ceil((end+36)/12)*12;clock(awardMonth);Military.setNobleMeritPolicyForSimulation('LOW');Military.updateNobility(awardMonth,core.teams,Dynasty.getAll());
 check(person().nobilityHistory?.some(g=>g.rank==='NAN'&&g.personalName===term.personalName),'same former governor earns a real low military title from actual service and capture');
 Military.endPersonCommands(term.personId,awardMonth,'DISMISSED');Civil.setPolicyForSimulation('BASELINE');Civil.update(awardMonth,core.teams,Dynasty.getAll());
 const dynasty=Dynasty.get(term.factionId)!,epoch=(dynasty.houseEpochs??[]).find(e=>e.endMonth===undefined)!;
 const candidate=civilGovernorCandidates(awardMonth,team(),Military.getPeople(),Civil.getTerms(),epoch.foundingRulerId,(id,born)=>Military.getFamilyMember(id,born),Military.getFormations()).find(c=>c.personId===term.personId);
 const target=eligibleCivilCities(awardMonth,team(),Civil.getTerms())[0];
 check(candidate&&target,'legally retired military person returns to the real civil candidate pool');
 const again=Civil.appoint(awardMonth,team(),target,candidate!,dynasty);
 check(again.personalName===term.personalName&&again.bornMonth===term.bornMonth&&again.personId===term.personId&&person().appointments.length===1,'military-to-civil transfer retains permanent name, birth and historical military service');
 const career=strict();hydrateWorldSave(core,structuredClone(career));check(diffCanonicalWorldSave(career,strict()).matched,'full civilian military noble and civilian career round-trips strictly');
 {const current=Civil.getByPerson(term.personId).at(-1)!,proof=civilCrossCareerEvidence(current,person(),History.getRecordedEvents());
  check(proof.multiplier===1.05&&proof.militaryEventIds.length===2,'actual ended military service supplies the sourced low five-percent civil promotion competition advantage');
  user().loyalty=100;for(const c of team().cities){c.loyalty=20;c.devastation=100;}
  for(let m=awardMonth+12;m<=awardMonth+36;m+=12){clock(m);(Civil as any).applyGovernance(m,core.teams);}
  const currentTerm=Civil.getByPerson(term.personId).at(-1)!,e=civilPromotionEvidence(currentTerm,core.simulator.year,100,team().cities.length,Civil.getTerms());check(e,'a genuine dual-career official still needs the unchanged actual governance and tenure promotion gates');
  if(e){const state=random.exportState(),weights=['BASELINE','LOW','MEDIUM'].map(policy=>civilPromotionCompetitionWeight(currentTerm,e,person(),History.getRecordedEvents(),policy as any));check(Math.abs(weights[1]/weights[0]-1.05)<1e-10&&Math.abs(weights[2]/weights[0]-1.1)<1e-10&&JSON.stringify(state)===JSON.stringify(random.exportState()),'baseline low medium calibration has bounded relative weights and consumes no world RNG');
   Civil.promote(core.simulator.year,currentTerm,team(),Dynasty.get(term.factionId)!);const promoted=strict();hydrateWorldSave(core,structuredClone(promoted));check(diffCanonicalWorldSave(promoted,strict()).matched,'real dual-career promotion proof strictly reads with the same permanent identity and military source events');
   const bad=structuredClone(promoted),event=(bad.worldHistory.events as any[]).filter(e=>e.type==='civil-governor-appointed'&&e.metadata?.personId===term.personId).at(-1);event.metadata.crossCareerEvidence=JSON.stringify({...proof,multiplier:2});let rejected=false;try{hydrateWorldSave(core,bad);}catch{rejected=true;}check(rejected,'strict read rejects a forged cross-career multiplier rather than accepting matching UI text');
  }
  hydrateWorldSave(core,structuredClone(career));
 }
 const scheduledDeath=deriveMilitaryLifeSchedule(person()).naturalDeathMonth;clock(scheduledDeath);Military.update(scheduledDeath,core.teams,core.allCities);Civil.update(scheduledDeath,core.teams,Dynasty.getAll());check(person().status==='DEAD'&&person().deathMonth===scheduledDeath,'civil-origin military career dies at the original resident scheduled month, including nonannual months');hydrateWorldSave(core,structuredClone(career));
 const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
 store.dispatch(setTeams(core.teams));store.dispatch(setWorldMonth({monthIndex:career.world.worldMonth,year:career.world.worldMonth}));store.dispatch(setSelectedFactionName(term.factionId));store.dispatch(setFactionDetailTab('people'));
 try{
  flushSync(()=>root.render(<Provider store={store}><FactionDetails/></Provider>));
  const button=(label:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===label);
  check(['概况','国势','王室','人物'].every(label=>button(label))&&!button('军政人物')&&!button('地方文官'),'four top-level destinations replace the crowded five-tab row');
  check(!host.textContent?.includes('姓名搜索')&&!button('全部')&&!button('武官')&&!button('文官'),'unified people archive removes both searches and the permanent secondary tab row');
  const historical=Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.startsWith('历任人物'));check(historical,'historical identities remain available in one folded archive');
  if(!host.querySelector(`[data-unified-person="${term.personId}"]`))flushSync(()=>historical!.click());
  const rows=host.querySelectorAll(`[data-unified-person="${term.personId}"]`);check(rows.length===1,'civil military transfer has exactly one permanent identity card in the unified list');
  const open=rows[0].querySelector<HTMLButtonElement>('button[aria-expanded]');if(open?.getAttribute('aria-expanded')!=='true')flushSync(()=>open!.click());
  check(rows[0].querySelector(`[data-person-career-identity="${term.personId}"]`)&&rows[0].querySelector('[data-civil-service]')&&rows[0].querySelector('[data-person-attribute="command"]'),'same unified card exposes real identity, both careers and ability bars');
  check(!rows[0].querySelector('[data-military-window]')&&rows[0].querySelectorAll('[data-person-career-identity]').length===1&&rows[0].querySelectorAll('[data-person-abilities]').length===1,'mixed civil military dossier mounts one shared person detail without a nested military list or duplicate ability panel');
  check(button('功臣世家')&&button('功臣录'),'family genealogy and merit roll remain reachable');

 }finally{flushSync(()=>root.unmount());host.remove();}
 clock(awardMonth+1);user().destroyUser(false,{cause:'BATTLE_DEATH',month:awardMonth+1,damageSource:'HOSTILE_HOME_OCCUPATION'});Civil.update(awardMonth+1,core.teams,Dynasty.getAll());
 check(person().status==='DEAD'&&person().personalName===term.personalName&&Civil.getByPerson(term.personId).every(t=>t.endMonth!==undefined),'one real death ends the full career without changing name or duplicating identity');strict();
 reset();
 const source=user(),foundingCity=core.allCities.find((c:any)=>c.id===term.cityId),population=core.teams.reduce((n:number,t:any)=>n+t.users.size,0);
 foundingCity.loyalty=0;foundingCity.devastation=100;
 for(const u of team().users){if(u.role==='NORMAL'){u.loyalty=u===source?0:100;u.player.setPosition(foundingCity.block.x+1,foundingCity.block.y+1);u.player.Body.reset(u.player.x,u.player.y);}}
 const founded=Factions.createRebelFaction({city:foundingCity,year:saved.world.worldMonth,factionType:'REBEL'}),ruler=founded&&Dynasty.getCurrentRuler(founded.name);
 check(founded&&ruler?.residentIdentity?.sourceUserId===term.sourceUserId,'a real former civil population identity can lead an actual resident-founded polity');
 Civil.update(saved.world.worldMonth,core.teams,Dynasty.getAll());
 check(ruler?.residentIdentity?.personId===term.personId&&ruler.residentIdentity.personalName===term.personalName&&ruler.residentIdentity.nameSource==='CIVIL'&&ruler.naturalDeathYear===residentNaturalDeathMonth(term.sourceUserId,term.bornMonth),'civil founder retains name, permanent population identity and original lifespan');
 check(core.teams.reduce((n:number,t:any)=>n+t.users.size,0)===population,'civil political entry creates no extra population');strict();
 const foundingProfile=governorProfile(term,saved.world.worldMonth),originalAbilities=personAbilities({kind:'RESIDENT',sourceUserId:term.sourceUserId,bornMonth:term.bornMonth});
 check(foundingProfile.linkedRuler?.id===ruler!.id&&JSON.stringify(foundingProfile.abilities)===JSON.stringify(originalAbilities)&&JSON.stringify(rulerAbilities(ruler!,Military.getPeople()))===JSON.stringify(originalAbilities),'civil-born monarch and original governor dossier retain exactly one permanent ability source');
 check(!foundingProfile.loyalty&&personAmbition(foundingProfile.abilities.source)===personAmbition(originalAbilities.source),'civil-born monarch has the same ambition and no meaningless self-loyalty');
 const royalDeath=saved.world.worldMonth+1;clock(royalDeath);for(const c of founded!.cities)c.loyalty=0;founded!.capitalCity!.underSiege=true;check(founded!.getUserById(term.sourceUserId)!.destroyUser(false,{cause:'BATTLE_DEATH',month:royalDeath,damageSource:'HOSTILE_HOME_OCCUPATION'}),'civil-born monarch can die through the actual royal body');
 const deceased=governorProfile(term,royalDeath);check(deceased.linkedRuler?.id===ruler!.id&&deceased.deathMonth===royalDeath,'governor archive resolves subsequent actual royal death through resident identity, never personal name');
 {const host=document.createElement('div'),root=createRoot(host);document.body.append(host);try{flushSync(()=>root.render(<Provider store={store}><GovernorDetail term={term} month={royalDeath}/></Provider>));check(host.textContent?.includes('享年')&&host.querySelector('[data-person-attribute="ambition"]')&&!host.querySelector('[data-person-attribute="loyalty"]'),'former governor dossier displays real royal death, permanent ambition and no self-loyalty');}finally{flushSync(()=>root.unmount());host.remove();}}strict();
 reset();
}
