import type {WorldEvent} from './WorldHistory';
/** Roles describe what is known about a place; a formal capital is not physical attendance evidence. */
export function cityEventReferences(e:WorldEvent){
 const out=new Map<string,string>(),m=e.metadata??{},add=(id:unknown,role:string)=>{if(typeof id==='string'&&id)out.set(id,role);};
 if(e.cityId)add(e.cityId,'DIRECT');
 if(['rebel-faction-founded','frontier-faction-founded','empire-split'].includes(e.type)){
  add(m.leaderSourceCityId,'FOUNDING');add(m.splitCoreCityId,'FOUNDING');if(typeof m.foundingCityIds==='string')for(const id of m.foundingCityIds.split(','))add(id,'FOUNDING');
 }
 if(e.type==='capital-relocated'){add(m.previousCapitalId,'FORMER_CAPITAL');add(m.newCapitalId,'NEW_CAPITAL');}
 if(['ruler-acceded','ruler-succession','state-founded','emperor-proclaimed'].includes(e.type)){
  if(m.accessionCapitalVersion===1&&m.capitalControlled===1&&m.accessionCapitalState==='CAPITAL')add(m.capitalCityId,'ACCESSION_CAPITAL');
  if(m.accessionCapitalVersion===1&&m.accessionCapitalState==='PROVISIONAL')add(m.provisionalSeatCityId,'PROVISIONAL_SEAT');
  if(['state-founded','emperor-proclaimed'].includes(e.type)&&typeof m.capitalCityId==='string')add(m.capitalCityId,'FORMAL_CAPITAL');
 }
 return out;
}
