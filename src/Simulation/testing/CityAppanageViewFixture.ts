import type {MilitaryPerson} from '../../Politics/MilitaryCommandRegistry';
import type {MilitaryAppanage} from '../../Politics/MilitaryAppanage';
import type {WorldEvent} from '../../History/WorldHistory';
/** Explicit historical projection fixture, not an alternative simulation or a natural-world observation. */
export function daliangAppanageFixture(){
 const events:WorldEvent[]=[],people:MilitaryPerson[]=[];
 const make=(personId:string,name:string,factionId:string,countryName:string,start:number,end:number,lost?:number,back?:number)=>{
  const grantId=`${personId}-grant`,nobleId=`${personId}-BO`,merit=`${personId}-capture`,rulerTitle=`${countryName}王${countryName==='秦'?'嬴钧':'赵庭佑'}`;
  const person={personId,personalName:name,name,sourceUserId:people.length+1,bornMonth:start-360,factionId,status:'DEAD',deathMonth:end,capturedEventIds:[merit],appointments:[{factionId,startMonth:start-24,endMonth:end,commandId:`command-${personId}`,officeHistory:[{office:'PIJIANG',month:start-24,eventId:'office',serviceMonths:0,captureEventIds:[]}]}],nobilityHistory:[],appanageHistory:[]} as MilitaryPerson;
  const add=(id:string,type:WorldEvent['type'],month:number,metadata:WorldEvent['metadata']={},extra:Partial<WorldEvent>={})=>events.push({id,type,year:month,monthIndex:month,title:type,category:'politics',importance:'major',factionIds:[factionId],actorFactionId:factionId,metadata,...extra} as WorldEvent);
  add(merit,'city-recovered',start-1,{}, {cityId:'daliang',cityName:'大梁'});
  const noble={eventId:nobleId,personId,personalName:name,factionId,countryName,epochFounderId:`house-${personId}`,month:start,rank:'BO',rulerId:`ruler-${personId}`,rulerTitle} as NonNullable<MilitaryPerson['nobilityHistory']>[number];person.nobilityHistory=[noble];add(nobleId,'military-ennobled',start,{personId,nobility:JSON.stringify(noble)});
  const grant:MilitaryAppanage={eventId:grantId,grantEventId:grantId,kind:'GRANTED',month:start,personId,personalName:name,factionId,countryName,epochFounderId:noble.epochFounderId,cityId:'daliang',cityName:'大梁',nobleGrantEventId:nobleId,rank:'BO',rulerId:noble.rulerId,rulerTitle,meritEventId:merit,sourceEventId:merit};
  const record=(a:MilitaryAppanage)=>{person.appanageHistory!.push(a);add(a.eventId,'military-appanage',a.month,{personId,appanage:JSON.stringify(a)},{cityId:'daliang',cityName:'大梁'});};record(grant);
  if(lost!==undefined){add(`${personId}-loss`,'city-captured',lost,{}, {cityId:'daliang',actorFactionId:'enemy'});record({...grant,eventId:`${grantId}-lost`,kind:'LOST',month:lost,sourceEventId:`${personId}-loss`});}
  if(back!==undefined){add(`${personId}-back`,'city-recovered',back,{}, {cityId:'daliang'});record({...grant,eventId:`${grantId}-back`,kind:'RESTORED',month:back,sourceEventId:`${personId}-back`});}
  add(`${personId}-death`,'military-person-died',end,{personId});record({...grant,eventId:`${grantId}-end`,kind:'ENDED',month:end,reason:'DEATH',sourceEventId:`${personId}-death`});people.push(person);
 };
 make('ju','居惟礼','zhao','赵',420,516);make('ying','嬴秉敬','qin','秦',1536,1678,1656,1667);
 return {people,events,cityId:'daliang',month:1680};
}
