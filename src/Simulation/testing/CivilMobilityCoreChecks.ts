import Civil,{civilGovernorCandidates,eligibleCivilCities} from '../../Politics/CivilAdministration';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import random from '../WorldRandom';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
import type {CivilGovernorTerm} from '../../Politics/CivilAdministrationSchema';
/** Controlled real city/office transactions; not a natural event-frequency sample. */
export function checkCivilMobility(core:any,input:WorldSaveV1,term:CivilGovernorTerm,check:(v:unknown,label:string)=>void){
 const clock=(month:number)=>core.simulator.clock.importState({worldMonth:month,elapsedMs:0,running:false});
 try{
  hydrateWorldSave(core,structuredClone(input));Civil.setPolicyForSimulation('BASELINE');
  let team=core.teams.find((t:any)=>t.name===term.factionId),source=team.cities.find((c:any)=>c.id===term.cityId),target=team.cities.find((c:any)=>c.id!==term.cityId&&!c.underSiege);
  if(team.cities.length<3){const extra=core.allCities.find((c:any)=>!c.destroyed&&c.ownerFactionId!==team.name);check(extra,'an existing third city supports lawful office vacancies after capture');extra.capture(team,input.world.worldMonth);}
  check(target,'a second existing same-country city is available for a real transfer');
  source.loyalty=50;source.devastation=40;
  for(let m=term.startMonth+12;m<=term.startMonth+60;m+=12){clock(m);(Civil as any).applyGovernance(m,core.teams);}
  const month=term.startMonth+60;source.loyalty=80;source.devastation=5;target.loyalty=30;target.devastation=60;
  const current=Civil.getByPerson(term.personId).find(t=>t.endMonth===undefined)!,before=exportWorldSave(core),write=History.addEvent;let failed=false;
  History.addEvent=function(e){const id=write.call(this,e);if(e.type==='civil-governor-appointed'){random.next();throw Error('injected transfer after history append');}return id;};
  try{Civil.transfer(month,current,team,target,Dynasty.get(team.name)!);}catch{failed=true;}finally{History.addEvent=write;}
  check(failed&&diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'failed actual transfer restores old term, new term, history, identity and consumed RNG');
  team=core.teams.find((t:any)=>t.name===term.factionId);target=team.cities.find((c:any)=>c.id===target.id);
  const moved=Civil.transfer(month,Civil.getByPerson(term.personId).find(t=>t.endMonth===undefined)!,team,target,Dynasty.get(team.name)!);
  check(moved.cityId===target.id&&moved.personId===term.personId&&Civil.getByPerson(term.personId).filter(t=>t.endMonth===undefined).length===1,'transfer preserves one real person, same rank and one active office');
  const saved=exportWorldSave(core);hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'transfer strictly round-trips with actual old receipts and new authority');
  const lostMonth=month+1;clock(lostMonth);team=core.teams.find((t:any)=>t.name===term.factionId);const enemy=core.teams.find((t:any)=>t!==team&&t.status==='ACTIVE');target=team.cities.find((c:any)=>c.id===moved.cityId);target.capture(enemy,lostMonth);Civil.update(lostMonth,core.teams,Dynasty.getAll());
  check(Civil.getByPerson(term.personId).at(-1)?.endReason==='CITY_LOST','actual capture ends the transferred office without inventing a political ban');
  const annual=Math.ceil(lostMonth/12)*12;clock(annual);const epoch=Dynasty.get(team.name)!.houseEpochs!.at(-1)!.foundingRulerId,candidate=civilGovernorCandidates(annual,team,Military.getPeople(),Civil.getTerms(),epoch,(id,born)=>Military.getFamilyMember(id,born),Military.getFormations(),Dynasty.getAll()).find(c=>c.personId===term.personId),city=eligibleCivilCities(annual,team,Civil.getTerms())[0];
  check(candidate&&city,'a real shared-identity former official can compete again after city loss');
  if(candidate&&city){const reappointed=Civil.appoint(annual,team,city,candidate,Dynasty.get(team.name)!);check(reappointed.personId===term.personId&&reappointed.assignmentId!==moved.assignmentId,'reappointment opens a distinct real term without replacing the lost-city career');const save=exportWorldSave(core);hydrateWorldSave(core,structuredClone(save));check(diffCanonicalWorldSave(save,exportWorldSave(core)).matched,'lost-city reappointment strictly reads without duplicate population or identity');}
 }finally{hydrateWorldSave(core,structuredClone(input));}
}
