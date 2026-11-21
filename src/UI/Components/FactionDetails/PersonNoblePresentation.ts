import type {MilitaryPerson} from '../../../Politics/MilitaryCommandRegistry';
import type {MilitaryFamily} from '../../../Politics/MilitaryFamily';
import {NOBLE_RANKS,NOBLE_NAMES,currentNobleGrant} from '../../../Politics/MilitaryNobility';
import {familyNobleRankAt} from '../../../Politics/FamilyNobleSuccession';
export function personNoblePresentation(person:MilitaryPerson|undefined,family:MilitaryFamily|undefined,memberId:string|undefined,factionId:string,epoch:string|undefined,month:number){
 const member=family?.members.find(m=>m.memberId===memberId),alive=person?person.deathMonth===undefined&&!person.politicalRulerId:member?.deathMonth===undefined,local=family?.factionId===factionId&&family.epochFounderId===epoch;
 const own=person&&alive&&person.factionId===factionId&&epoch?currentNobleGrant(person,factionId,month,epoch):undefined,inherited=alive&&local&&member?familyNobleRankAt(family!,member,month):undefined;
 if(own&&(!inherited||NOBLE_RANKS.indexOf(own.rank)>=NOBLE_RANKS.indexOf(inherited)))return {rank:own.rank,kind:'PERSONAL' as const,label:NOBLE_NAMES[own.rank]};
 if(inherited)return {rank:inherited,kind:'INHERITED' as const,label:`袭${NOBLE_NAMES[inherited]}`};
 const history=[...(person?.nobilityHistory??[]).filter(g=>g.factionId===factionId&&g.month<=month).map(g=>({rank:g.rank,month:g.month,revoked:person?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.factionId===g.factionId&&h.epochFounderId===g.epochFounderId&&h.month>=g.month&&h.month<=month),source:'曾封'})),...(family?.factionId===factionId?family.nobleSuccession??[]:[]).filter(a=>a.kind==='SUCCEEDED'&&a.holderMemberId===memberId&&a.rank&&a.month<=month).map(a=>({rank:a.rank!,month:a.month,revoked:family?.nobleSuccession?.some(end=>end.kind==='ENDED'&&['FORFEITED','REVOKED'].includes(end.reason)&&end.previousMemberId===memberId&&(end.period??1)===(a.period??1)&&end.month>=a.month&&end.month<=month),source:'曾袭'}))].sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank)||b.month-a.month);
 const highest=history[0],g=highest?.revoked?(history.find(h=>!h.revoked&&h.month>highest.month)??highest):highest;return g?{rank:g.rank,kind:g.revoked?'REVOKED' as const:'HISTORICAL' as const,label:g.revoked?'旧爵已追夺':`${NOBLE_NAMES[g.rank]}（${g.source}）`}:undefined;
}
