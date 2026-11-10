import {createNaturalCore} from './NaturalCoreHarness';
import CivilAdministration,{civilGovernorCandidates,civilGovernorStatus,eligibleCivilCities} from '../../Politics/CivilAdministration';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {Provider} from 'react-redux';
import {store} from '../../store';
import {setSelectedCityId,setSelectedFactionName,setTeams,setWorldMonth} from '../../store/rootSlice';
import CivilGovernancePanel from '../../UI/Components/CivilAdministration/CivilGovernancePanel';
import CityDetails from '../../UI/Components/CityDetails';

export async function runCivilAdministrationCore(seed='civil-administration-z61'){
 const {core,game}=await createNaturalCore(seed),checks:string[]=[];
 const check=(value:unknown,label:string)=>{if(!value)throw Error(label);checks.push(label);};
 const clock=(month:number)=>(core.simulator as any).clock.importState({worldMonth:month,elapsedMs:0,running:false});
 const strict=()=>exportWorldSave(core);
 try{
  CivilAdministration.reset();CivilAdministration.setPolicyForSimulation('BASELINE');core.setWorldRunning(true);
  for(let month=0;month<120;month++){for(let step=0;step<30;step++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}
  core.setWorldRunning(false);CivilAdministration.setPolicyForSimulation('MEDIUM');
  const team=core.teams.find(team=>team.status==='ACTIVE'&&team.identityStage==='STATE'&&team.cities.length>=2&&Dynasty.getCurrentRuler(team.name)),dynasty=team&&Dynasty.get(team.name);
  check(team&&dynasty,'actual formal country with multiple cities is available');
  const month=core.simulator!.year,cities=eligibleCivilCities(month,team!,CivilAdministration.getTerms()),epoch=(dynasty!.houseEpochs??[]).find(epoch=>epoch.foundingRulerId===dynasty!.currentRulerId);
  check(cities.length>0&&epoch,'actual cities satisfy stable-control appointment conditions');
  const candidates=civilGovernorCandidates(month,team!,Military.getPeople(),CivilAdministration.getTerms(),epoch!.foundingRulerId,(id,bornMonth)=>Military.getFamilyMember(id,bornMonth),Military.getFormations());
  check(candidates.length>0,'real living adults produce authoritative governor candidates');
  check(Military.getFormations().filter(formation=>formation.status==='ACTIVE').every(formation=>!candidates.some(candidate=>candidate.personId===formation.commanderPersonId)),'active commanders are excluded from civilian office');
  const ordinary=candidates.find(candidate=>candidate.identitySource==='ORDINARY_RESIDENT'),chosen=(ordinary??candidates[0])!,city=cities[0],ruler=dynasty!.rulers.find(ruler=>ruler.id===dynasty!.currentRulerId)!;
  const before=strict(),writer=History.addEvent;History.addEvent=function(event){const id=writer.call(this,event);if(event.type==='civil-governor-appointed')throw Error('injected appointment write');return id;};
  try{expectThrow(()=>CivilAdministration.appoint(month,team!,city,chosen,dynasty!));}finally{History.addEvent=writer;}
  check(diffCanonicalWorldSave(before,strict()).matched,'failed governor appointment rolls back registry and history');
  const term=CivilAdministration.appoint(month,team!,city,chosen,dynasty!);
  check(term.personId===chosen.personId&&term.cityId===city.id&&term.sourceUserId===chosen.sourceUserId&&term.rulerId===ruler.id,'appointment binds actual person, city, month and ruling sovereign');
  check(History.getRecordedEvents().some(event=>event.id===term.appointEventId&&event.type==='civil-governor-appointed'),'appointment has one canonical city-linked event');
  check(validateWorldSave(strict()).valid,'new governor appointment passes strict V58 save validation');
  expectThrow(()=>CivilAdministration.appoint(month,team!,city,chosen,dynasty!));
  check(CivilAdministration.getTerms(team!.name).length===1,'one city has one active governor and no duplicate appointment');
  check(!civilGovernorCandidates(month,team!,Military.getPeople(),CivilAdministration.getTerms(),epoch!.foundingRulerId,(id,bornMonth)=>Military.getFamilyMember(id,bornMonth),Military.getFormations()).some(candidate=>candidate.personId===chosen.personId),'the same person cannot hold a second governorship');
  city.loyalty=50;city.devastation=30;
  for(const due of [month+12,month+24,month+36]){clock(due);CivilAdministration.update(due,core.teams,Dynasty.getAll());}
  const governed=CivilAdministration.getTerms(team!.name)[0];
  check(city.loyalty>50||city.devastation<30,'governor changes actual city loyalty or devastation recovery');
  check(governed.loyaltyRecovered+governed.devastationRecovered>=3&&History.getRecordedEvents().some(event=>event.id===governed.meritEventId),'actual bounded recovery yields one sourced local-governance achievement');
  const saved=strict();check(validateWorldSave(saved).valid&&civilGovernorStatus(governed,city,month+36)!=='已离任','governed city and achievement survive strict save');
  {const host=document.createElement('div'),root=createRoot(host);document.body.append(host);store.dispatch(setTeams(core.teams));store.dispatch(setWorldMonth({monthIndex:saved.world.worldMonth,year:saved.world.worldMonth}));store.dispatch(setSelectedFactionName(team!.name));try{flushSync(()=>root.render(<Provider store={store}><CivilGovernancePanel factionId={team!.name} month={saved.world.worldMonth} initialPersonId={term.personId}/></Provider>));check(host.textContent?.includes('现任')&&host.textContent?.includes(term.personalName)&&host.textContent?.includes(term.cityName)&&host.querySelector(`[data-civil-governor-detail="${term.assignmentId}"]`),'local-official tab shows the actual incumbent, city and civil dossier');store.dispatch(setSelectedCityId(term.cityId));flushSync(()=>root.render(<Provider store={store}><CityDetails/></Provider>));check(host.textContent?.includes('地方官')&&host.textContent?.includes(`现任郡守：${term.personalName}`)&&host.textContent?.includes('任期：'),'city overview shows the same real governor and tenure');}finally{flushSync(()=>root.unmount());host.remove();store.dispatch(setSelectedCityId(undefined));}}
  for(const mutate of [(save:any)=>save.registries.civilAdministration.terms[0].personId='fake',(save:any)=>save.registries.civilAdministration.terms[0].startMonth+=1,(save:any)=>save.registries.civilAdministration.terms[0].loyaltyRecovered=-1]){const bad=structuredClone(saved);mutate(bad);check(!validateWorldSave(bad).valid,'strict save rejects forged civil-governor identity, date or governance result');}
  hydrateWorldSave(core,structuredClone(saved));const enemy=core.teams.find(other=>other.name!==team!.name&&other.status==='ACTIVE')!,lostCity=core.allCities.find(item=>item.id===term.cityId)!;lostCity.capture(enemy,month+37);CivilAdministration.update(month+37,core.teams,Dynasty.getAll());const lostTerm=CivilAdministration.getTerms(team!.name)[0];if(lostTerm.endMonth!==month+37||lostTerm.endReason!=='CITY_LOST')throw Error(JSON.stringify({lostTerm,owner:lostCity.ownerFactionId,teamStatus:team!.status,enemy:enemy.name}));checks.push('city capture ends the old governor without claiming death');
  hydrateWorldSave(core,structuredClone(saved));const body=core.teams.find(item=>item.name===team!.name)!.getUserById(term.sourceUserId);check(body,'appointed governor still has the original live population identity');if(body)body.destroyUser(false,{cause:'BATTLE_DEATH',month:month+37,damageSource:'HOSTILE_HOME_OCCUPATION'});CivilAdministration.update(month+37,core.teams,Dynasty.getAll());const deathTerm=CivilAdministration.getTerms(team!.name)[0];check(deathTerm.endMonth===month+37&&deathTerm.endReason==='DEATH','governor death ends the office in the same real month');
  hydrateWorldSave(core,structuredClone(saved));const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let month=0;month<12;month++){for(let step=0;step<30;step++)(core as any).advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return strict();};const first=resume(),second=resume();check(diffCanonicalWorldSave(first,second).matched,'governor save and office continue twelve months deterministically');hydrateWorldSave(core,structuredClone(first));check(diffCanonicalWorldSave(first,strict()).matched,'second read preserves governor term, city effects and history');
  return {seed,checks,month:strict().world.worldMonth,terms:CivilAdministration.getTerms(),diagnostics:CivilAdministration.getDiagnostics(strict().world.worldMonth),cityEffects:{loyalty:city.loyalty,devastation:city.devastation},saveSchemaVersion:strict().saveSchemaVersion};
 }finally{game.destroy(true);}
}
function expectThrow(work:()=>unknown){let threw=false;try{work();}catch{threw=true;}if(!threw)throw Error('Expected transaction rejection');}
