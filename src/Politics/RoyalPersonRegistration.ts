import type {Ruler} from './Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
export interface RoyalPersonRegistration {version:1;eventId:string;factionId:string;rulerId:string;bornMonth:number;month:number;parentId?:string;}
export function registerRoyalPerson(r:Ruler,factionId:string,month:number,write:(e:WorldEvent)=>string){
 const record:RoyalPersonRegistration={version:1,eventId:`${r.id}-registered`,factionId,rulerId:r.id,bornMonth:r.bornYear,month,...r.parentId?{parentId:r.parentId}:{}};
 if(write({id:record.eventId,type:'royal-person-registered',year:month,category:'politics',importance:'normal',actorFactionId:factionId,factionIds:[factionId],rulerId:r.id,title:`${r.houseName.replace(/氏$/,'')}${r.givenName}载入王室亲缘。`,metadata:{royalRegistration:JSON.stringify(record)}})!==record.eventId)throw Error('Royal registration rejected');
 r.registration=record;return r;
}
export function verifiedRoyalRegistration(r:Ruler,factionId:string,events:readonly WorldEvent[],month:number){
 const record=r.registration,e=record&&events.find(e=>e.id===record.eventId);
 return !!record&&record.version===1&&record.factionId===factionId&&record.rulerId===r.id&&record.bornMonth===r.bornYear&&record.parentId===r.parentId&&record.month<=month&&r.bornYear<=record.month&&e?.type==='royal-person-registered'&&e.rulerId===r.id&&e.actorFactionId===factionId&&(e.monthIndex??e.year)===record.month&&e.metadata?.royalRegistration===JSON.stringify(record);
}
