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
 const city=core.allCities.find((c:any)=>c.id===term.cityId),enemy=core.teams.find((t:any)=>t.name!==term.factionId&&t.status==='ACTIVE');
 city.capture(enemy,end);Civil.update(end,core.teams,Dynasty.getAll());
 for(const formation of Military.getFormations().filter(f=>f.status==='ACTIVE'&&f.factionId===term.factionId))Military.endPersonCommands(formation.commanderPersonId,end,'DISMISSED');
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
 reset();
}
