import type {Dynasty,Ruler} from './Dynasty';
import {getRecordedKinRelation,type RecordedKinRelation} from './DynasticCandidateRules';
import type {WorldEvent} from '../History/WorldHistory';
import type {MilitaryPerson,MilitaryFormation} from './MilitaryCommandRegistry';
import {deriveMilitaryCareer} from './MilitaryCareerEvidence';
export const ROYAL_HONOR_NAMES={FENGJUN:'封君',QINWANG:'亲王'} as const;
export interface RoyalHonor {
 version:1;eventId:string;factionId:string;epochFounderId:string;houseName:string;month:number;
 recipientRulerId:string;recipientName:string;bornMonth:number;
 issuerRulerId:string;issuerName:string;issuerTitle:string;countryName:string;
 rank:keyof typeof ROYAL_HONOR_NAMES;sovereigntyRank:'KING'|'EMPEROR';relation:RecordedKinRelation;
 basis:'KIN_SENIORITY'|'MILITARY_MERIT';meritEventIds:string[];
}
export interface HonorFaction {name:string;status:string;identityStage:string;sovereigntyRank:string;stateFoundedMonth?:number;}
export const royalName=(r:Ruler)=>r.houseName.replace(/氏$/,'')+r.givenName;
/** Historical life checks do not reuse today's role to rewrite an earlier title. */
export function livingRoyalAt(r:Ruler,month:number){return r.bornYear<=month&&(r.deathMonth===undefined||r.deathMonth>month)&&(r.naturalDeathYear??r.plannedEndYear??Infinity)>month;}
export function effectiveRoyalHonor(r:Ruler,d:Pick<Dynasty,'houseEpochs'>,month:number,sovereigntyRank?:string){
 if(!livingRoyalAt(r,month)||r.accessionYear!==undefined&&r.accessionYear<=month)return;
 return r.royalHonors?.filter(g=>g.month<=month&&g.recipientRulerId===r.id&&g.houseName===r.houseName&&d.houseEpochs?.some(e=>e.foundingRulerId===g.epochFounderId&&e.startMonth<=month&&(e.endMonth===undefined||month<e.endMonth))&&(sovereigntyRank===undefined||g.rank!=='QINWANG'||sovereigntyRank==='EMPEROR')).sort((a,b)=>Number(b.rank==='QINWANG')-Number(a.rank==='QINWANG')||b.month-a.month)[0];
}
export function royalHonorMerits(r:Ruler,people:readonly MilitaryPerson[],formations:MilitaryFormation[],events:WorldEvent[],month:number,factionId:string){
 const p=r.militaryIdentity&&people.find(p=>p.personId===r.militaryIdentity?.personId&&p.royalIdentity?.rulerId===r.id&&p.royalIdentity.factionId===factionId&&p.bornMonth===r.bornYear);
 if(!p)return [];
 return deriveMilitaryCareer({...p,appointments:p.appointments.filter(a=>a.factionId===factionId)},formations,events,month).capturedEventIds.filter(id=>events.some(e=>e.id===id&&e.actorFactionId===factionId)).slice(0,2);
}
/** No extra RNG, people, kin or army. At most one actual grant every three years. */
export function planRoyalHonor(input:{faction:HonorFaction;dynasty:Dynasty;month:number;countryName:string;issuerTitle:string;people:readonly MilitaryPerson[];formations:MilitaryFormation[];events:WorldEvent[]}):RoyalHonor|undefined{
 const {faction:f,dynasty:d,month:m}=input,issuer=d.rulers.find(r=>r.id===d.currentRulerId),epoch=d.houseEpochs?.find(e=>e.startMonth<=m&&(e.endMonth===undefined||m<e.endMonth));
 if(m%12!==0||f.status!=='ACTIVE'||f.identityStage!=='STATE'||!['KING','EMPEROR'].includes(f.sovereigntyRank)||f.stateFoundedMonth===undefined||f.stateFoundedMonth>m||!issuer||issuer.status!=='ruling'||issuer.accessionYear===undefined||m-issuer.accessionYear<12||!livingRoyalAt(issuer,m)||!epoch||issuer.houseName!==d.houseName)return;
 const all=d.rulers.flatMap(r=>r.royalHonors??[]);if(all.some(g=>g.month<=m&&m-g.month<36))return;
 const rank=f.sovereigntyRank==='EMPEROR'?'QINWANG':'FENGJUN',cap=rank==='QINWANG'?4:2;
 const eligible=d.rulers.flatMap(r=>{
  const relation=getRecordedKinRelation(r,issuer,d.rulers),merits=royalHonorMerits(r,input.people,input.formations,input.events,m,f.name);
  if(r.id===issuer.id||r.houseName!==d.houseName||!['heir','kin'].includes(r.status)||r.accessionYear!==undefined||r.reignOrdinal!==undefined||!livingRoyalAt(r,m)||m-r.bornYear<288||!relation||relation==='COLLATERAL_KIN'||r.royalHonors?.some(g=>g.epochFounderId===epoch.foundingRulerId&&g.rank===rank))return [];
  const active=effectiveRoyalHonor(r,d,m,f.sovereigntyRank),occupied=d.rulers.filter(q=>effectiveRoyalHonor(q,d,m,f.sovereigntyRank)).length;
  if(!active&&occupied>=cap)return [];
  return [{r,relation,merits}];
 }).sort((a,b)=>b.merits.length-a.merits.length||a.r.bornYear-b.r.bornYear||a.r.id.localeCompare(b.r.id));
 const c=eligible[0];if(!c)return;
 return {version:1,eventId:`royal-honor-${f.name}-${c.r.id}-${epoch.foundingRulerId}-${rank}`,factionId:f.name,epochFounderId:epoch.foundingRulerId,houseName:d.houseName,month:m,recipientRulerId:c.r.id,recipientName:royalName(c.r),bornMonth:c.r.bornYear,issuerRulerId:issuer.id,issuerName:royalName(issuer),issuerTitle:input.issuerTitle,countryName:input.countryName,rank,sovereigntyRank:f.sovereigntyRank as 'KING'|'EMPEROR',relation:c.relation,basis:c.merits.length?'MILITARY_MERIT':'KIN_SENIORITY',meritEventIds:c.merits};
}
export function royalHonorText(g:RoyalHonor){return `${g.issuerTitle}${g.basis==='MILITARY_MERIT'?'以军功':'以宗亲资望'}授${g.recipientName}${ROYAL_HONOR_NAMES[g.rank]}之号。`;}
