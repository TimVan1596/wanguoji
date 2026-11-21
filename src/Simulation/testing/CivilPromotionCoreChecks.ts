import Civil from '../../Politics/CivilAdministration';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import History from '../../History/WorldHistory';
import {civilPromotionEvidence} from '../../Politics/CivilPromotion';
import {civilNobleMerit} from '../../Politics/CivilNobility';
import {nobleChronicle} from '../../Politics/MilitaryNobility';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {diffCanonicalWorldSave,type WorldSaveV1} from '../../Persistence/WorldSaveSchema';
import type {CivilGovernorTerm} from '../../Politics/CivilAdministrationSchema';
/** Controlled real transactions, not natural event-frequency evidence. No invented people or receipts. */
export function checkCivilPromotion(core:any,input:WorldSaveV1,term:CivilGovernorTerm,check:(v:unknown,label:string)=>void){
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  hydrateWorldSave(core,structuredClone(input));Civil.setPolicyForSimulation('BASELINE');
  let team=core.teams.find((t:any)=>t.name===term.factionId);let user=team.getUserById(term.sourceUserId);const initial=Civil.getByPerson(term.personId)[0];user.loyalty=100;
  check(initial.office==='XIANLING'&&Military.getPerson(term.personId)?.appointments.length===0,'county first appointment shares a person record without inventing military service');
  // Existing cities change hands through their real capture transaction to prepare central vacancies.
  for(const city of core.allCities.filter((c:any)=>!c.destroyed&&c.ownerFactionId!==team.name)){if(team.cities.length>=9)break;city.capture(team,input.world.worldMonth);}
  Civil.update(input.world.worldMonth,core.teams,Dynasty.getAll());
  check(team.cities.length>=9,'nine actual controlled cities provide existing national capacity for central posts');
  for(const city of team.cities){city.loyalty=20;city.devastation=100;}
  let current=initial;
  for(const duration of [36,60,72]){
   const due=current.startMonth+duration;
   for(let m=input.world.worldMonth+12;m<=due;m+=12){if(m<=core.simulator.year)continue;clock(m);(Civil as any).applyGovernance(m,core.teams);}
   clock(due);const row=Civil.getByPerson(term.personId).find(t=>t.assignmentId===current.assignmentId)!;
   const evidence=civilPromotionEvidence(row,due,user.loyalty,team.cities.length,Civil.getTerms());
   if(!evidence){check(false,`real candidate lacks required governance/strategy for ${row.office} promotion`);return;}
   const before=exportWorldSave(core),write=History.addEvent;let failed=false;
   History.addEvent=function(e){const id=write.call(this,e);if(e.type==='civil-governor-appointed')throw Error('injected promotion');return id;};
   try{Civil.promote(due,row,team,Dynasty.get(team.name)!);}catch{failed=true;}finally{History.addEvent=write;}
   check(failed&&diffCanonicalWorldSave(before,exportWorldSave(core)).matched,'failed promotion restores old office, new office, history, population and RNG');
   current=Civil.promote(due,row,team,Dynasty.get(team.name)!);
   check(current.personId===term.personId&&Civil.getByPerson(term.personId).filter(t=>t.endMonth===undefined).length===1,`real promotion to ${current.office} preserves one identity and one office`);
   check(current.office==='JUNSHOU'?current.cityId===term.cityId:current.cityId===undefined&&current.cityName===undefined,'central post never masquerades as a city governor');
   const save=exportWorldSave(core);hydrateWorldSave(core,structuredClone(save));check(diffCanonicalWorldSave(save,exportWorldSave(core)).matched,'each promotion strictly round-trips with the original receipt evidence');team=core.teams.find((t:any)=>t.name===term.factionId);user=team.getUserById(term.sourceUserId);
  }
  const p=Military.getPerson(term.personId)!,at=core.simulator.year,terms=Civil.getByPerson(term.personId),merit=civilNobleMerit(p,terms,at,100);
  check(merit,'actual accumulated recoveries qualify for a low civil peerage');
  if(merit){const dy=Dynasty.get(team.name)!,ruler=Dynasty.getCurrentRuler(team.name)!,g:any={...merit,basis:'CIVIL',eventId:`civil-noble-${p.personId}-${current.epochFounderId}-${merit.rank}`,personId:p.personId,sourceUserId:p.sourceUserId,bornMonth:p.bornMonth,personalName:p.personalName,factionId:team.name,countryName:team.displayName,epochFounderId:current.epochFounderId,rulerId:ruler.id,rulerTitle:Dynasty.getRulerHistoricalTitle(ruler.id,team.name,at),month:at,previousRank:'NONE',commandId:'',captureEventIds:[],cityIds:[],importantCityIds:[],importantEventIds:[]};
   Military.civilTransaction(team,()=>Military.recordCivilNoble(p,g));
   check(History.getRecordedEvents().some(e=>e.id===g.eventId&&e.title===nobleChronicle(g))&&p.appointments.length===0,'civil merit produces a real distinct peerage source and no fictional command');
   const saved=exportWorldSave(core);hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'civil peerage and four-tier career strictly read again');void dy;
   const bad=structuredClone(saved);bad.registries.civilAdministration.terms.find(t=>t.promotion)!.promotion!.meritEventIds=['forged'];let rejected=false;try{hydrateWorldSave(core,bad);}catch{rejected=true;}check(rejected,'forged promotion evidence is rejected');
  }
 }finally{hydrateWorldSave(core,structuredClone(input));}
}
