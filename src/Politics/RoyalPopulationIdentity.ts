import type {Dynasty,Ruler} from './Dynasty';
/** Original native royal population source. Never derived from a display name. */
export function getRulerUserId(rulerId:string){let hash=0;for(let i=0;i<rulerId.length;i++)hash=(hash*31+rulerId.charCodeAt(i))>>>0;return 1800000000+hash%100000000;}
export const nativeRoyal=(r:Pick<Ruler,'militaryIdentity'|'militaryUsurperIdentity'|'residentIdentity'>)=>!r.militaryIdentity&&!r.militaryUsurperIdentity&&!r.residentIdentity;
export function royalPopulationIdentity(u:{id:number;bornMonth:number;nativeRoyalRulerId?:string;rulerId?:string;historicalPersonId?:string;player?:{rulerId?:string}},dynasties:readonly Dynasty[]){
 const rulers=dynasties.flatMap(d=>d.rulers);
 return rulers.find(r=>r.id===u.nativeRoyalRulerId||r.id===u.rulerId||r.id===u.player?.rulerId||r.id===u.historicalPersonId||nativeRoyal(r)&&getRulerUserId(r.id)===u.id&&r.bornYear===u.bornMonth||r.residentIdentity?.sourceUserId===u.id&&r.bornYear===u.bornMonth||[r.militaryIdentity,r.militaryUsurperIdentity].some(i=>i?.sourceUserId===u.id&&r.bornYear===u.bornMonth));
}
/** A royal title is technical source text, never evidence that an unrelated resident owns that name. */
export function isRoyalTitleLabel(name:string,dynasties:readonly Dynasty[]){
 return dynasties.some(d=>d.rulers.some(r=>{
  const personal=r.houseName.replace(/氏$/,'')+r.givenName;if(name===personal||!name.endsWith(personal))return false;
  const prefix=name.slice(0,-personal.length),countries=[d.factionId,r.regimeNameAtEnd].filter((v):v is string=>typeof v==='string'&&v.length>0).flatMap(v=>[v,v.replace(/(?:国|朝)$/,'')]);
  return countries.some(country=>['王','皇帝','帝','首领'].some(title=>prefix===country+title));
 }));
}
