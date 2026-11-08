import type {Dynasty,Ruler} from './Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
import {FAMILY_NOBLE_NAMES as NAMES,FAMILY_NOBLE_RANKS as RANKS} from './FamilyNobleSuccession';
export function createRoyalNobleReadingIndex(events:readonly WorldEvent[],month:number){
 const personal=new Map<string,any[]>(),revoked=new Map<string,any[]>(),grants=new Map<string,any>(),bans=new Map<string,any[]>();
 for(const e of events){if((e.monthIndex??e.year)>month)continue;if(e.type==='military-ennobled')try{const g=JSON.parse(String(e.metadata?.nobility)),rows=personal.get(g.personId)??[];rows.push(g);personal.set(g.personId,rows);grants.set(g.eventId,g);}catch{}else if(e.type==='military-title-revoked')try{const h=JSON.parse(String(e.metadata?.honor)),rows=revoked.get(h.personId)??[];rows.push(h);revoked.set(h.personId,rows);}catch{}else if(e.type==='military-court-sanction')try{const a=JSON.parse(String(e.metadata?.courtAct)),rows=bans.get(a.personId)??[];rows.push(a);bans.set(a.personId,rows);}catch{}}
 return {personal,revoked,grants,bans};
}
/** One main title and independent source histories; never gives an office or royal standing. */
export function royalNobleReading(r:Ruler,d:Dynasty,events:readonly WorldEvent[],month:number,index=createRoyalNobleReadingIndex(events,month)){
 const acts=(d.royalNobility??[]).filter(a=>a.month<=month),lasts=new Map(acts.map(a=>[a.chainId,a])),held=acts.filter(a=>a.holderRulerId===r.id&&a.rank);let current=[...lasts.values()].find(a=>a.holderRulerId===r.id&&a.kind!=='ENDED'&&(r.deathMonth??Infinity)>month&&(r.accessionYear??Infinity)>month);
 const identity=r.militaryIdentity,own=(identity?index.personal.get(identity.personId)??[]:[]).filter(g=>g.sourceUserId===identity!.sourceUserId&&g.bornMonth===r.bornYear&&g.factionId===d.factionId);
 const revoked=(g:any)=>(index.revoked.get(g.personId)??[]).some(h=>h.factionId===g.factionId&&h.epochFounderId===g.epochFounderId&&h.month>=g.month);
 if(current){const source=index.grants.get(current.sourceGrantEventId),holderBans=r.militaryIdentity?index.bans.get(r.militaryIdentity.personId)??[]:[];if(source&&revoked(source)||holderBans.some(a=>a.kind==='COURT_BAN'&&['FORFEITURE','EXECUTION'].includes(a.severity)&&a.factionId===d.factionId&&a.epochFounderId===current!.epochFounderId))current=undefined;}
 const best=[...held.map(a=>({rank:a.rank!,month:a.month,countryName:a.countryName,inherited:a.kind==='SUCCEEDED',revoked:acts.some(n=>n.chainId===a.chainId&&n.previousRulerId===r.id&&n.reason==='REVOKED')||!!index.grants.get(a.sourceGrantEventId)&&revoked(index.grants.get(a.sourceGrantEventId))})),...own.map(g=>({rank:g.rank as typeof RANKS[number],month:g.month,countryName:g.countryName,inherited:false,revoked:revoked(g)}))].sort((a,b)=>RANKS.indexOf(b.rank)-RANKS.indexOf(a.rank)||b.month-a.month)[0];
 if(!best)return;
 const inherited=current?.kind==='SUCCEEDED',name=r.houseName.replace(/氏$/,'')+r.givenName;
 return {acts:acts.filter(a=>a.previousRulerId===r.id||a.holderRulerId===r.id),personal:own.map(g=>({...g,revoked:revoked(g)})),current,best,inherited,heading:best.revoked&&!current?`旧爵已追夺 · ${name}`:`${current?.countryName??best.countryName} · ${NAMES[current?.rank??best.rank]} · ${name}`,label:current?inherited?'合法承袭爵':'本人军功受封':best.revoked?'旧爵已追夺':`${best.inherited?'曾袭':(r.deathMonth??Infinity)<=month?'生前受封':'曾封'}${NAMES[best.rank]} · 历史爵位`};
}
