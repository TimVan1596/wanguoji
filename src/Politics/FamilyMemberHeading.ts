import type {FamilyArchiveProjection} from './FamilyArchiveProjection';
import {FAMILY_NOBLE_RANKS,FAMILY_NOBLE_NAMES} from './FamilyNobleSuccession';
type Row=FamilyArchiveProjection['rows'] extends Map<string,infer R>?R:never;
export function familyMemberTitleKind(row:Row){const p=row.effectivePersonal,i=row.inherited;return p&&(!i?.rank||FAMILY_NOBLE_RANKS.indexOf(p.rank)>=FAMILY_NOBLE_RANKS.indexOf(i.rank))?'PERSONAL':i?.rank?'INHERITED':'HISTORICAL';}
/** One display title, while personal and inherited grants remain separate source records. */
export function familyMemberHeading(row:Row,month:number,countryAt:(id:string,month:number)=>string,politics:readonly string[]=[]){
 const name=row.member.name,personal=row.effectivePersonal,inherited=row.inherited;
 if(personal&&familyMemberTitleKind(row)==='PERSONAL')return `${countryAt(personal.factionId,month)} · ${FAMILY_NOBLE_NAMES[personal.rank]} · ${name}`;
 if(inherited?.rank)return `${countryAt(inherited.factionId,month)} · 袭${FAMILY_NOBLE_NAMES[inherited.rank]} · ${name}`;
 const titles=[...row.personalHistory.map(g=>({rank:g.rank,month:g.month,country:g.countryName||countryAt(g.factionId,g.month),kind:'曾封',revoked:row.person?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.factionId===g.factionId&&h.epochFounderId===g.epochFounderId&&h.month>=g.month&&h.month<=month)})),...row.inheritedHistory.filter(a=>a.rank).map(a=>({rank:a.rank!,month:a.month,country:countryAt(a.factionId,a.month),kind:'曾袭',revoked:false}))].sort((a,b)=>FAMILY_NOBLE_RANKS.indexOf(b.rank)-FAMILY_NOBLE_RANKS.indexOf(a.rank)||b.month-a.month);
 const historical=titles[0];
 if(historical?.revoked)return `旧爵已追夺 · ${name}`;
 if(historical)return `${historical.kind}${historical.country}${FAMILY_NOBLE_NAMES[historical.rank]} · ${name}`;
 return politics.some(t=>t.includes('伏诛'))?`${name} · 因谋逆伏诛`:politics.some(t=>t.includes('禁仕'))?`${name} · 谋逆禁仕`:name;
}
