import type {Dynasty,Ruler} from './Dynasty';
import {getRecordedKinRelation,type RecordedKinRelation} from './DynasticCandidateRules';
import type {WorldEvent} from '../History/WorldHistory';
import type {MilitaryPerson,MilitaryFormation} from './MilitaryCommandRegistry';
import {verifiedPoliticalOffice} from './MilitaryPoliticalInfluence';
import {deriveMilitaryCareer} from './MilitaryCareerEvidence';
export const ROYAL_HONOR_NAMES={WUANJUN:'武安君',ZHENGUOGONG:'镇国公'} as const;
export interface RoyalHonor {
 version:2;eventId:string;factionId:string;epochFounderId:string;houseName:string;month:number;
 recipientRulerId:string;recipientName:string;bornMonth:number;
 issuerRulerId:string;issuerName:string;issuerTitle:string;countryName:string;
 rank:keyof typeof ROYAL_HONOR_NAMES;sovereigntyRank:'KING'|'EMPEROR';relation:RecordedKinRelation;
 basis:'MILITARY_MERIT';meritEventIds:string[];
}
export interface HonorFaction {name:string;status:string;identityStage:string;sovereigntyRank:string;stateFoundedMonth?:number;}
export const royalName=(r:Ruler)=>r.houseName.replace(/氏$/,'')+r.givenName;
/** Historical life checks do not reuse today's role to rewrite an earlier title. */
export function livingRoyalAt(r:Ruler,month:number){return r.bornYear<=month&&(r.deathMonth===undefined||r.deathMonth>month)&&(r.naturalDeathYear??r.plannedEndYear??Infinity)>month;}
export function effectiveRoyalHonor(r:Ruler,d:Pick<Dynasty,'houseEpochs'>,month:number,_sovereigntyRank?:string){
 if(!livingRoyalAt(r,month)||r.accessionYear!==undefined&&r.accessionYear<=month)return;
 return r.royalHonors?.filter(g=>g.month<=month&&g.recipientRulerId===r.id&&g.houseName===r.houseName&&d.houseEpochs?.some(e=>e.foundingRulerId===g.epochFounderId&&e.startMonth<=month&&(e.endMonth===undefined||month<e.endMonth))).sort((a,b)=>Number(b.rank==='ZHENGUOGONG')-Number(a.rank==='ZHENGUOGONG')||b.month-a.month)[0];
}
export function royalHonorMerits(r:Ruler,people:readonly MilitaryPerson[],formations:MilitaryFormation[],events:WorldEvent[],month:number,factionId:string){
 const p=r.militaryIdentity&&people.find(p=>p.personId===r.militaryIdentity?.personId&&p.royalIdentity?.rulerId===r.id&&p.royalIdentity.factionId===factionId&&p.bornMonth===r.bornYear);
 if(!p)return [];
 const career=deriveMilitaryCareer({...p,appointments:p.appointments.filter(a=>a.factionId===factionId)},formations,events,month);
 return career.capturedEventIds.filter(id=>events.some(e=>e.id===id&&e.actorFactionId===factionId));
}
/** A higher honor requires distinct cities including a proven enemy capital, never merely an order or siege. */
export function royalMeritRank(ids:readonly string[],events:readonly WorldEvent[]):RoyalHonor['rank']|undefined {
 const wins=events.filter(e=>ids.includes(e.id));
 return new Set(wins.map(e=>e.cityId)).size>=2&&wins.some(e=>e.metadata?.wasCapital===1)?'ZHENGUOGONG':wins.length?'WUANJUN':undefined;
}

/** No extra RNG, people, kin or army. At most one actual grant every three years. */
export function planRoyalHonor(input:{faction:HonorFaction;dynasty:Dynasty;month:number;countryName:string;issuerTitle:string;people:readonly MilitaryPerson[];formations:MilitaryFormation[];events:WorldEvent[]}):RoyalHonor|undefined{
 const {faction:f,dynasty:d,month:m}=input,issuer=d.rulers.find(r=>r.id===d.currentRulerId),epoch=d.houseEpochs?.find(e=>e.startMonth<=m&&(e.endMonth===undefined||m<e.endMonth));
 if(m%12!==0||f.status!=='ACTIVE'||f.identityStage!=='STATE'||!['KING','EMPEROR'].includes(f.sovereigntyRank)||f.stateFoundedMonth===undefined||f.stateFoundedMonth>m||!issuer||issuer.status!=='ruling'||issuer.accessionYear===undefined||m-issuer.accessionYear<12||!livingRoyalAt(issuer,m)||!epoch||issuer.houseName!==d.houseName)return;
 const all=d.rulers.flatMap(r=>r.royalHonors??[]);if(all.some(g=>g.month<=m&&m-g.month<36))return;
 const cap=f.sovereigntyRank==='EMPEROR'?4:2;
 const eligible=d.rulers.flatMap(r=>{
  const relation=getRecordedKinRelation(r,issuer,d.rulers),merits=royalHonorMerits(r,input.people,input.formations,input.events,m,f.name);
  const rank=royalMeritRank(merits,input.events),person=r.militaryIdentity&&input.people.find(p=>p.personId===r.militaryIdentity?.personId),appointment=person?.appointments.find(a=>a.factionId===f.name&&a.startMonth<=m&&a.endMonth===undefined);
  if(!rank||!person||person.status!=='ACTIVE'||person.deathMonth!==undefined||person.factionId!==f.name||!appointment||!verifiedPoliticalOffice(person,appointment.commandId,f.name,m,input.events))return [];
  if(r.id===issuer.id||r.houseName!==d.houseName||!['heir','kin'].includes(r.status)||r.accessionYear!==undefined||r.reignOrdinal!==undefined||!livingRoyalAt(r,m)||m-r.bornYear<288||!relation||relation==='COLLATERAL_KIN'||r.royalHonors?.some(g=>g.epochFounderId===epoch.foundingRulerId&&g.rank===rank))return [];
  const active=effectiveRoyalHonor(r,d,m,f.sovereigntyRank),occupied=d.rulers.filter(q=>effectiveRoyalHonor(q,d,m,f.sovereigntyRank)).length;
  if(!active&&occupied>=cap)return [];
  return [{r,relation,merits,rank}];
 }).sort((a,b)=>b.merits.length-a.merits.length||a.r.bornYear-b.r.bornYear||a.r.id.localeCompare(b.r.id));
 const c=eligible[0];if(!c)return;const rank=c.rank;
 return {version:2,eventId:`royal-honor-${f.name}-${c.r.id}-${epoch.foundingRulerId}-${rank}`,factionId:f.name,epochFounderId:epoch.foundingRulerId,houseName:d.houseName,month:m,recipientRulerId:c.r.id,recipientName:royalName(c.r),bornMonth:c.r.bornYear,issuerRulerId:issuer.id,issuerName:royalName(issuer),issuerTitle:input.issuerTitle,countryName:input.countryName,rank,sovereigntyRank:f.sovereigntyRank as 'KING'|'EMPEROR',relation:c.relation,basis:'MILITARY_MERIT',meritEventIds:c.merits};
}
export function royalHonorText(g:RoyalHonor){return `${g.issuerTitle}${g.rank==='ZHENGUOGONG'?'以累克城邑、攻取敌都之功':'以取城之功'}授${g.recipientName}${ROYAL_HONOR_NAMES[g.rank]}之号。`;}

export interface RoyalHonorClaim {rulerId:string;eventId:string;rank:RoyalHonor['rank'];epochFounderId:string;advantage:number;}
export const ROYAL_HONOR_ADVANTAGE={WUANJUN:.06,ZHENGUOGONG:.10} as const;
export function royalHonorCandidateClaims(d:Pick<Dynasty,'rulers'|'houseEpochs'>,month:number,rank?:string):RoyalHonorClaim[]{
 return d.rulers.flatMap(r=>{const g=effectiveRoyalHonor(r,d,month,rank);return g?[{rulerId:r.id,eventId:g.eventId,rank:g.rank,epochFounderId:g.epochFounderId,advantage:ROYAL_HONOR_ADVANTAGE[g.rank]}]:[];});
}
/** Relative candidate advantage capped at 50%, including real command and actual supporter. */
export const combinedRoyalCandidateWeight=(base:number,military:number,honor:number,support=0)=>base*Math.min(1.5,(1+military+honor)*(1+support));
