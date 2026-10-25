import type {MilitaryPerson,MilitaryFormation} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
export interface MilitaryActivity {eventId:string;cityId:string;commandId:string;factionId:string;worldMonth:number;kind:'CAPTURE'|'SIEGE'|'DEFENSE';}
/** Evidence projection only. Orders and repeated short contacts never earn experience. */
export function deriveMilitaryActivities(person:MilitaryPerson,formations:MilitaryFormation[],events:readonly WorldEvent[],month:number,captures:readonly string[],separateKinds=false){
 const verified=new Set(captures),starts=new Map<string,WorldEvent[]>(),ends=new Map<string,WorldEvent[]>();
 for(const e of events){const id=e.metadata?.battleId;if(typeof id!=='string')continue;const map=e.type==='siege-started'?starts:e.type==='siege-ended'?ends:undefined;if(map)map.set(id,[...(map.get(id)??[]),e]);}
 const activities:MilitaryActivity[]=[],seen=new Set<string>();
 for(const e of [...events].sort((a,b)=>(a.monthIndex??a.year)-(b.monthIndex??b.year))){
  const at=e.monthIndex??e.year,m=e.metadata??{},command=String(m.commandId??''),a=person.appointments.find(a=>a.commandId===command&&a.factionId===e.actorFactionId&&a.startMonth<=at&&at<=(a.endMonth??month));
  if(!e.cityId||at>month||at>(person.deathMonth??month)||!a||!formations.some(f=>f.commandId===command&&f.commanderPersonId===person.personId&&f.factionId===a.factionId))continue;
  let kind:MilitaryActivity['kind']|undefined;
  if(verified.has(e.id))kind='CAPTURE';
  else if(m.personId===person.personId&&typeof m.battleId==='string'){
   const ss=starts.get(m.battleId)??[],ee=ends.get(m.battleId)??[];
   if(ss.length!==1||ee.length!==1)continue;
   const start=ss[0],end=ee[0],duration=(end.monthIndex??end.year)-(start.monthIndex??start.year)+1;
   if(start.cityId!==e.cityId||end.cityId!==e.cityId||start.actorFactionId!==end.actorFactionId||start.targetFactionId!==end.targetFactionId||(start.monthIndex??start.year)<a.startMonth||(end.monthIndex??end.year)>at||!Number.isSafeInteger(duration)||duration<1)continue;
   if(e.type==='siege-ended'&&m.reason!=='CAPTURED'&&duration>=6&&start.actorFactionId===a.factionId&&start.metadata?.commandId===command&&start.metadata.personId===person.personId&&Number(start.metadata.attackers)>=1&&Number(m.attackers)>=1)kind='SIEGE';
   if(e.type==='siege-defended'&&e.actorFactionId===end.targetFactionId&&e.targetFactionId===end.actorFactionId&&end.metadata?.reason==='REPULSED'&&Number(m.defenders)>0&&Number(end.metadata.defenders)>0)kind='DEFENSE';
  }
  // One location per appointment, regardless of repeated attacks or monthly contacts.
  const key=JSON.stringify(separateKinds?[command,e.cityId,kind]:[command,e.cityId]);
  if(kind&&!seen.has(key)){seen.add(key);activities.push({eventId:e.id,cityId:e.cityId,commandId:command,factionId:a.factionId,worldMonth:at,kind});}
 }
 return activities;
}
