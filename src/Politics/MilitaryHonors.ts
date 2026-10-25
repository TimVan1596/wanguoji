import type {MilitaryPerson,MilitaryFormation} from './MilitaryCommandRegistry';
import type {Dynasty} from './Dynasty';
import type {WorldEvent} from '../History/WorldHistory';
import {currentNobleGrant,deriveNobleMerits,nobleEpochForRuler,NOBLE_NAMES,type NobleRank} from './MilitaryNobility';
import {getHistoricalFactionIdentity} from '../History/HistoricalFactionIdentity';
import {formatRulerTitleAtMonth} from './RulerTitleRules';
export interface MilitaryHonor {
 eventId:string;kind:'POSTHUMOUS'|'REVOKED';personId:string;personalName:string;factionId:string;countryName:string;epochFounderId:string;
 rulerId:string;rulerTitle:string;month:number;grantEventId:string;rank:NobleRank;sourceEventId:string;
 epithet?:'武烈'|'武毅'|'武襄';deathMonth?:number;reason:'BATTLE_SERVICE'|'DISTINGUISHED_SERVICE'|'VERIFIED_SECESSION';meritEventIds:string[];
}
export function honorAuthority(team:any,dy:Dynasty|undefined,month:number){
 const r=dy?.rulers.find(r=>r.id===dy.currentRulerId),epoch=nobleEpochForRuler(dy,dy?.currentRulerId??null);
 if(!team||!dy||team.name!==dy.factionId||team.status!=='ACTIVE'||team.identityStage!=='STATE'||team.stateFoundedMonth===undefined||team.stateFoundedMonth>month||!['KING','EMPEROR'].includes(team.sovereigntyRank)||!r||!epoch||r.status!=='ruling'||r.accessionYear===undefined||r.accessionYear>month||r.endYear!==undefined||r.deathMonth!==undefined||(r.naturalDeathYear??Infinity)<=month)return;
 return {factionId:team.name as string,countryName:getHistoricalFactionIdentity(team,month).name,epochFounderId:epoch.foundingRulerId,rulerId:r.id,rulerTitle:formatRulerTitleAtMonth(team,`${r.houseName.replace(/氏$/,'')}${r.givenName}`,month)};
}
/** Only a committed, identity-backed military founding proves rebellion; transfers and political pressure do not. */
export function verifiedMilitarySecessions(p:MilitaryPerson,events:WorldEvent[],dynasties:Dynasty[],month:number){
 return events.filter(e=>e.type==='empire-split'&&(e.monthIndex??e.year)<=month&&e.metadata?.militaryPersonId===p.personId).filter(e=>{
  try{const r=dynasties.flatMap(d=>d.rulers).find(r=>r.id===e.metadata?.foundingRulerId),i=r?.residentIdentity,m=i?.military;
   return !!m&&p.politicalRulerId===r!.id&&m.personId===p.personId&&i!.sourceUserId===p.sourceUserId&&i!.bornMonth===p.bornMonth&&m.sourceFactionId===e.targetFactionId&&m.worldMonth===(e.monthIndex??e.year)&&e.metadata?.militarySplitEvidence===JSON.stringify(m);
  }catch{return false;}
 });
}
export function nextMilitaryHonors(p:MilitaryPerson,formations:MilitaryFormation[],events:WorldEvent[],month:number,teams:any[],dynasties:Dynasty[]):MilitaryHonor[]{
 if(month%12!==0)return [];
 const honors:MilitaryHonor[]=[],splits=verifiedMilitarySecessions(p,events,dynasties,month);
 for(const e of splits){
  const factionId=e.targetFactionId!,authority=honorAuthority(teams.find(t=>t.name===factionId),dynasties.find(d=>d.factionId===factionId),month);if(!authority)continue;
  const grant=currentNobleGrant(p,factionId,month,authority.epochFounderId);
  if(!grant||grant.month>(e.monthIndex??e.year)||(p.honorHistory??[]).some(h=>h.kind==='REVOKED'&&h.factionId===factionId&&h.epochFounderId===grant.epochFounderId))continue;
  honors.push({...authority,eventId:`military-revocation-${grant.eventId}`,kind:'REVOKED',personId:p.personId,personalName:p.personalName,month,grantEventId:grant.eventId,rank:grant.rank,sourceEventId:e.id,reason:'VERIFIED_SECESSION',meritEventIds:[]});
 }
 if(p.status!=='DEAD'||p.deathMonth===undefined||p.deathMonth>month||p.politicalRulerId||splits.length||(p.honorHistory??[]).some(h=>h.kind==='POSTHUMOUS'))return honors;
 const death=events.find(e=>e.type==='military-person-died'&&e.metadata?.personId===p.personId&&(e.monthIndex??e.year)===p.deathMonth&&e.metadata?.deathCause===p.deathCause);if(!death)return honors;
 const last=p.appointments.filter(a=>a.startMonth<=p.deathMonth!).at(-1);if(!last||last.factionId!==death.actorFactionId)return honors;
 // A former reigning royal belongs to the independent monarch posthumous system.
 if(p.royalIdentity&&dynasties.flatMap(d=>d.rulers).some(r=>r.id===p.royalIdentity!.rulerId&&r.reignOrdinal!==undefined))return honors;
 const factionId=last.factionId,authority=honorAuthority(teams.find(t=>t.name===factionId),dynasties.find(d=>d.factionId===factionId),month);if(!authority)return honors;
 const g=currentNobleGrant(p,factionId,p.deathMonth,authority.epochFounderId);if(!g||!currentNobleGrant(p,factionId,month,authority.epochFounderId))return honors;
 const m=deriveNobleMerits(p,formations,events,factionId,p.deathMonth),battle=p.deathCause==='BATTLE_DEATH'&&last.endMonth===p.deathMonth;
 if(!(battle&&m.cityIds.length>=2&&m.serviceMonths>=60)&&!(g.rank!=='BO'&&m.cityIds.length>=4&&m.importantCityIds.length>=1&&m.serviceMonths>=120))return honors;
 honors.push({...authority,eventId:`military-posthumous-${p.personId}`,kind:'POSTHUMOUS',personId:p.personId,personalName:p.personalName,month,grantEventId:g.eventId,rank:g.rank,sourceEventId:death.id,deathMonth:p.deathMonth,epithet:battle?'武烈':m.importantCityIds.length>=2?'武毅':'武襄',reason:battle?'BATTLE_SERVICE':'DISTINGUISHED_SERVICE',meritEventIds:[...new Set([...m.captureEventIds,...m.importantEventIds])]});
 return honors;
}
export function militaryHonorText(h:MilitaryHonor){return h.kind==='REVOKED'?`${h.personalName}举兵割据后，${h.rulerTitle}追夺其${NOBLE_NAMES[h.rank]}。`:`${h.rulerTitle}以真实军功追谥故${NOBLE_NAMES[h.rank]}${h.personalName}为“${h.epithet}”。`;}
export function militaryPosthumousLabel(p:MilitaryPerson,factionId:string,month:number){const h=p.honorHistory?.find(h=>h.kind==='POSTHUMOUS'&&h.factionId===factionId&&h.month<=month);return h?`谥${h.epithet}`:'';}
