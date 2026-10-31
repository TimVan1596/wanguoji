import type {WorldEvent} from './WorldHistory';
import {mergePoliticalReading} from './PoliticalReadingProjection';
import {formatHistoryEventTitle,type HistoryFactionLike,resolveFactionHistoricalName} from './HistoryRenderRules';
import {cityEventReferences} from './CityEventReferences';
export {cityEventReferences} from './CityEventReferences';
const coreTypes=new Set(['city-founded','city-captured','city-recovered','capital-fallen','city-revolt','rebel-faction-founded','frontier-faction-founded','empire-split','capital-relocated','city-destroyed','state-founded','emperor-proclaimed','ruler-acceded','ruler-succession','faction-dissolved','faction-extinct']);
export function cityChronicle(cityId:string,events:readonly WorldEvent[],month:number){
 const local=events.filter(e=>(e.monthIndex??e.year)<=month&&cityEventReferences(e).has(cityId)&&coreTypes.has(e.type));
 const founding=local.filter(e=>['empire-split','rebel-faction-founded','frontier-faction-founded'].includes(e.type));
 const rows=mergePoliticalReading(local).filter(e=>{
  if(e.type!=='city-revolt'||!e.historyGroupId)return true;
  return !founding.some(f=>f.historyGroupId===e.historyGroupId&&f.actorFactionId===e.actorFactionId&&(f.monthIndex??f.year)===(e.monthIndex??e.year)&&String(f.metadata?.foundingCityIds??f.metadata?.leaderSourceCityId??'').split(',').includes(cityId));
 });
 return rows.sort((a,b)=>(b.monthIndex??b.year)-(a.monthIndex??a.year)||b.id.localeCompare(a.id));
}
export function cityChronicleText(e:WorldEvent,cityId:string,factions:Map<string,HistoryFactionLike>){
 const m=e.metadata??{},role=cityEventReferences(e).get(cityId),at=e.monthIndex??e.year,name=(id?:string)=>resolveFactionHistoricalName(factions,id,at);
 if(e.type==='capital-relocated')return role==='FORMER_CAPITAL'?`${name(e.actorFactionId)}迁都${m.newCapitalName??e.cityName??'他城'}，此城不复为都。`:`${name(e.actorFactionId)}自${m.previousCapitalName??'旧都'}迁都于此。`;
 if(['ruler-acceded','ruler-succession'].includes(e.type))return `${typeof m.nextRulerName==='string'?m.nextRulerName:e.title.replace(/继位$/,'')}承统，时${role==='ACCESSION_CAPITAL'?'以此为都':'治此城'}。`;
 return formatHistoryEventTitle(e,factions);
}
