import Dynasty from '../../../Politics/Dynasty';
import {Typography} from '@mui/material';
import Military from '../../../Politics/MilitaryCommandRegistry';
import type {MilitaryFamily,MilitaryFamilyMember} from '../../../Politics/MilitaryFamily';
import {FAMILY_NOBLE_NAMES,familyNobleTitle,familyNobleText} from '../../../Politics/FamilyNobleSuccession';
import {NOBLE_NAMES,NOBLE_RANKS} from '../../../Politics/MilitaryNobility';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import HistoricalEventArchive from './HistoricalEventArchive';
/** Read-only link to an already-existing political identity, including civilian rebel founders. */
export function familyRoyalMember(m:MilitaryFamilyMember,month:number){for(const d of Dynasty.getAll()){const r=d.rulers.find(r=>r.accessionYear!==undefined&&r.accessionYear<=month&&r.bornYear===m.bornMonth&&(r.residentIdentity?.sourceUserId===m.sourceUserId||m.militaryPersonId&&(r.militaryUsurperIdentity?.personId===m.militaryPersonId||r.militaryIdentity?.personId===m.militaryPersonId)));if(r)return {ruler:r,factionId:d.factionId};}return undefined;}
export function familyMemberNobleLabel(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){
 const title=familyNobleTitle(f,m,month),epoch=Dynasty.get(f.factionId)?.houseEpochs?.find(e=>e.foundingRulerId===f.epochFounderId);if(title&&!familyRoyalMember(m,month)&&(epoch?.endMonth??Infinity)>month)return `袭${title}`;
 const former=f.nobleSuccession?.filter(a=>a.month<=month&&a.kind==='SUCCEEDED'&&a.holderMemberId===m.memberId).at(-1);return former?.rank?`曾袭${FAMILY_NOBLE_NAMES[former.rank]}（已失效）`:undefined;
}
export function familyMemberMeritLabel(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){const p=m.militaryPersonId?Military.getPerson(m.militaryPersonId):undefined,g=p?.nobilityHistory?.filter(g=>g.factionId===f.factionId&&g.month<=month).at(-1);if(!g)return;const revoked=p?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.month<=month&&h.factionId===g.factionId&&h.epochFounderId===g.epochFounderId);return `本人曾封${NOBLE_NAMES[g.rank]}${revoked?' · 已追夺':''}`;}
export function familyNobleSummary(f:MilitaryFamily,month:number){const last=f.nobleSuccession?.filter(a=>a.month<=month).at(-1),holder=f.members.find(m=>m.memberId===last?.holderMemberId);return last?.kind==='SUCCEEDED'&&holder?`${holder.name} · ${familyMemberNobleLabel(f,holder,month)}`:last?.kind==='ENDED'?`承袭已终止 · ${familyNobleText(f,last)}`:'尚未发生爵位承袭';}
export function FamilyTitleBadge({personId,factionId,month}:{personId:string;factionId:string;month:number}){const f=Military.getFamilies().find(f=>f.factionId===factionId&&f.members.some(m=>m.militaryPersonId===personId));if(!f)return null;const m=f.members.find(m=>m.militaryPersonId===personId)!,label=familyMemberNobleLabel(f,m,month);return label?<Typography fontSize=".75rem">家族承袭：{label}（与本人军功授爵分列）</Typography>:null;}
export default function FamilyNoblePanel({family:f,month}:{family:MilitaryFamily;month:number}){
 const acts=f.nobleSuccession?.filter(a=>a.month<=month)??[],founder=Military.getPerson(f.founderPersonId),grants=founder?.nobilityHistory?.filter(g=>g.factionId===f.factionId&&g.epochFounderId===f.epochFounderId&&g.month<=month)??[],highest=[...grants].sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank))[0];
 return <><Typography fontSize=".76rem">始祖最高曾受军功爵：{highest?NOBLE_NAMES[highest.rank]:'未见正式授爵'} · {familyNobleSummary(f,month)}</Typography>{acts.length>0&&<HistoricalEventArchive title="爵位承袭与世降" totalCount={acts.length} entries={()=>acts.map(a=>({id:a.eventId,content:<><Typography fontSize=".76rem">{formatWorldDate(a.month)}，{familyNobleText(f,a)}</Typography><details><summary>史料依据</summary><Typography fontSize=".7rem">{a.eventId} · 原始军功授爵：{a.sourceGrantEventId} · 前任：{a.previousMemberId} · 第{a.step}次承袭处理 · 来源：{a.sourceEventIds.join('、')}</Typography></details></>}))}/>}<details><summary>承袭制度</summary><Typography fontSize=".72rem">一族一链，持爵者死亡后按已登记在世、在籍直接子女的出生顺序选一人；每次下降一级，公、侯、伯、子、男之后断袭。无合格子女亦断袭，不代袭，不补造子嗣。军功授爵独立，赦免军事禁令不返还已失爵位；不传军职、部队、食邑或城市。本支新功续振仍据本人真实功劳，不因袭爵而续振。</Typography></details></>;
}
