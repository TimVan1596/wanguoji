import type {WorldEvent} from './WorldHistory';
import {formatAccessionCapital,ACCESSION_EVENT_TYPES} from './AccessionCapitalContext';
import {formatWorldDate} from '../Simulation/WorldTime';
const MONTHS=['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
export const formatChronicleDate=(month:number)=>formatWorldDate(month).replace(/年(\d+)月$/,(_s,n)=>`年${MONTHS[Number(n)-1]}`);
/** "Still seated" requires an older real capital record and no intervening contradictory transition. */
function remainedCapital(e:WorldEvent,events:readonly WorldEvent[]){
 const at=e.monthIndex??e.year,m=e.metadata!,id=m.capitalCityId,faction=e.actorFactionId;
 const prior=events.filter(x=>(x.monthIndex??x.year)<at&&x.actorFactionId===faction).flatMap(x=>{
  const p=x.metadata??{},city=x.type==='capital-relocated'?p.newCapitalId:x.type==='state-founded'||p.accessionCapitalVersion===1&&p.capitalControlled===1?p.capitalCityId:undefined;
  return typeof city==='string'?[{month:x.monthIndex??x.year,city}]:[];
 }).sort((a,b)=>b.month-a.month);
 if(!prior.length||prior[0].city!==id||new Set(prior.filter(x=>x.month===prior[0].month).map(x=>x.city)).size!==1)return false;
 return !events.some(x=>{const month=x.monthIndex??x.year;return month>prior[0].month&&month<=at&&(x.type==='capital-relocated'&&x.actorFactionId===faction||['capital-fallen','faction-exiled','faction-extinct','faction-submitted','faction-merged'].includes(x.type)&&(x.targetFactionId===faction||['faction-submitted','faction-merged'].includes(x.type)&&x.actorFactionId===faction)||['city-captured','city-revolt','city-destroyed'].includes(x.type)&&x.cityId===id&&x.actorFactionId!==faction);});
}
/** Reading only: precise dates, identities, event IDs and the audit text remain untouched. */
export function chronicleReadingText(e:WorldEvent,base:string,events:readonly WorldEvent[]){
 const capital=formatAccessionCapital(e),m=e.metadata??{};
 let text=base.split(' · ').filter(x=>x!==capital).join('，').replace(/[。；，]+$/,'').replace(/所属编组/g,'所部');
 if(e.type==='ruler-succession'&&typeof m.nextRulerName==='string')text=text.replace(`${m.nextRulerName}继位`,`${m.nextRulerName}嗣位`);
 if(ACCESSION_EVENT_TYPES.includes(e.type)){
  if(m.accessionCapitalVersion===1&&m.accessionCapitalState==='CAPITAL'&&m.capitalControlled===1&&m.accessionFactionId===e.actorFactionId&&m.accessionMonth===(e.monthIndex??e.year)&&typeof m.capitalCityId==='string'&&typeof m.capitalCityName==='string')text+=`，${remainedCapital(e,events)?'仍都':'都'}${m.capitalCityName}`;
  else if(m.accessionCapitalState==='EXILED')text+='，时无实际国都';
  else if(m.accessionCapitalState==='PROVISIONAL'&&typeof m.provisionalSeatCityName==='string')text+=`，治${m.provisionalSeatCityName}`;
  else if(m.accessionCapitalState==='NO_CAPITAL')text+='，时无实际国都';
  else if(capital)text+='，国都未载';
 }
 return `${text}。`;
}
