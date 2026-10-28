import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import type {NobleRank} from './MilitaryNobility';
export const OWNERSHIP_EVENTS=['city-founded','city-captured','city-recovered','capital-fallen','city-revolt'];
export interface MilitaryAppanage {
 eventId:string;grantEventId:string;kind:'GRANTED'|'LOST'|'RESTORED'|'ENDED';month:number;personId:string;personalName:string;
 factionId:string;countryName:string;epochFounderId:string;cityId:string;cityName:string;nobleGrantEventId:string;rank:NobleRank;
 rulerId:string;rulerTitle:string;meritEventId:string;sourceEventId:string;reason?:string;
}
export function appanageText(a:MilitaryAppanage){
 if(a.kind==='GRANTED')return `${a.rulerTitle}赐${a.personalName}以${a.cityName}为名义食邑；不改变城池归属及军权。`;
 if(a.kind==='LOST')return `${a.cityName}失于他国，${a.personalName}的食邑失地，原爵位不因此撤销。`;
 if(a.kind==='RESTORED')return `${a.cityName}重归${a.countryName}，${a.personalName}原食邑恢复；本次并非重新授爵。`;
 const reasons:Record<string,string>={DEATH:'本人去世',ACCESSION:'本人登位',TRANSFER:'本人转属',TITLE_REVOKED:'旧爵被正式追夺',DYNASTY_ENDED:'原王统终结',STATE_ENDED:'原政权失去在国权力',CITY_DESTROYED:'封邑城池毁灭'};
 return `${a.personalName}的${a.cityName}食邑因${reasons[a.reason??'']??'原身份终结'}而结束，原授封史料保留。`;
}
export function appanageEndReason(g:MilitaryAppanage,p:MilitaryPerson,e:WorldEvent){
 const m=e.metadata??{},pid=m.personId===p.personId;
 if(e.type==='military-person-died'&&pid)return 'DEATH';
 if(e.type==='military-command-ended'&&pid&&m.endReason==='TRANSFERRED'&&e.actorFactionId===g.factionId)return 'TRANSFER';
 if(e.type==='military-title-revoked'&&pid){try{const h=JSON.parse(String(m.honor));if(h.factionId===g.factionId&&h.epochFounderId===g.epochFounderId)return 'TITLE_REVOKED';}catch{}}
 const ruler=p.politicalRulerId??p.royalIdentity?.rulerId;
 if(ruler&&(e.type==='ruler-acceded'&&e.rulerId===ruler||['ruler-succession','ruler-deposed'].includes(e.type)&&m.nextRulerId===ruler||e.type==='dynasty-usurped'&&e.rulerId===ruler))return 'ACCESSION';
 if(e.type==='dynasty-usurped'&&e.actorFactionId===g.factionId)return 'DYNASTY_ENDED';
 if(['faction-exiled','faction-extinct','faction-submitted','faction-merged'].includes(e.type)&&e.targetFactionId===g.factionId)return 'STATE_ENDED';
 if(e.type==='city-destroyed'&&e.cityId===g.cityId)return 'CITY_DESTROYED';
 return undefined;
}
/** Replay genuine ownership and life facts after the formal grant, including multiple changes in one month. */
export function appanageChanges(p:MilitaryPerson,last:MilitaryAppanage,events:WorldEvent[],month:number){
 if(last.kind==='ENDED')return [];
 const start=events.findIndex(e=>e.id===(last.kind==='GRANTED'?last.eventId:last.sourceEventId));if(start<0)return [];
 let state:MilitaryAppanage['kind']=last.kind;const result:MilitaryAppanage[]=[];
 for(const e of events.slice(start+1)){
  const at=e.monthIndex??e.year;if(at>month)continue;let kind:MilitaryAppanage['kind']|undefined,reason=appanageEndReason(last,p,e);
  if(reason)kind='ENDED';
  else if(e.cityId===last.cityId&&OWNERSHIP_EVENTS.includes(e.type)){
   if(e.actorFactionId===last.factionId&&state==='LOST')kind='RESTORED';
   else if(e.actorFactionId&&e.actorFactionId!==last.factionId&&state!=='LOST')kind='LOST';
  }
  if(!kind)continue;
  const {reason:_old,...base}=last;const record:MilitaryAppanage={...base,eventId:`${last.grantEventId}-${kind}-${e.id}`,kind,month:at,sourceEventId:e.id,...(reason?{reason}:{})};result.push(record);state=kind;if(kind==='ENDED')break;
 }
 return result;
}
