import type {FamilyArchiveProjection} from './FamilyArchiveProjection';
import {MILITARY_OFFICE_NAMES} from './MilitaryOffice';
type Row=FamilyArchiveProjection['rows'] extends Map<string,infer R>?R:never;
/** A past title remains an identity even after transfer, forfeiture or the holder's death. */
export function familyMemberServiceStatus(row:Row,month:number,heir=false,locatedOnly=false){
 const royal=row.political,a=row.appointments.at(-1);
 return royal?`${(royal.r.endYear??Infinity)>month?'现任':'曾任'}君主`:a?`${row.activeOffice?'现任':'原任'}${MILITARY_OFFICE_NAMES[a.officeHistory?.filter(g=>g.month<=month).at(-1)?.office??'XIAOWEI']}`:row.inherited?'合法袭爵 · 未任军职':row.inheritedHistory.length?'曾经袭爵 · 未任军职':row.personalHistory.length?'本人受爵 · 未任军职':heir?'直接承袭候选':row.member?.birth?`${row.life==='DEAD'?'已故子嗣':month-row.member.bornMonth<216?'在世未成年子嗣':(row.member.populationEnteredMonth??Infinity)>month?'成年 · 尚未居民入籍':'成年子嗣'} · 未任军职`:locatedOnly?'已登记居民 · 史事定位':'普通居民 · 父系桥梁';
}
