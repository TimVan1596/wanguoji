import {useState} from 'react';
import {familyNoblePeriods} from '../../../Politics/FamilyNoblePeriods';
import {formatHistoryEventTitle} from '../../../History/HistoryRenderRules';
import Game from '../../../Game/Game';
import Dynasty from '../../../Politics/Dynasty';
import {Typography} from '@mui/material';
import Military from '../../../Politics/MilitaryCommandRegistry';
import type {MilitaryFamily,MilitaryFamilyMember} from '../../../Politics/MilitaryFamily';
import {FAMILY_NOBLE_NAMES} from '../../../Politics/FamilyNobleSuccession';
import {NOBLE_NAMES,NOBLE_RANKS} from '../../../Politics/MilitaryNobility';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import HistoricalEventArchive from './HistoricalEventArchive';
import {familyArchive,familyArchiveSource} from './FamilyArchiveSource';
import {explainFamilyTitleEnd} from '../../../Politics/FamilyArchiveProjection';
/** Read-only link to an already-existing political identity, including civilian rebel founders. */
export function familyRoyalMember(m:MilitaryFamilyMember,month:number){for(const d of Dynasty.getAll()){const r=d.rulers.find(r=>r.accessionYear!==undefined&&r.accessionYear<=month&&r.bornYear===m.bornMonth&&(r.residentIdentity?.sourceUserId===m.sourceUserId||m.militaryPersonId&&(r.militaryUsurperIdentity?.personId===m.militaryPersonId||r.militaryIdentity?.personId===m.militaryPersonId)));if(r)return {ruler:r,factionId:d.factionId};}return undefined;}
export function familyMemberNobleLabel(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){const row=familyArchive(f,month).rows.get(m.memberId);if(row?.inherited?.rank)return `袭${FAMILY_NOBLE_NAMES[row.inherited.rank]}`;const former=row?.inheritedHistory.at(-1);return former?.rank?`曾袭${FAMILY_NOBLE_NAMES[former.rank]}（已失效）`:undefined;}
export function familyMemberMeritLabel(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){const row=familyArchive(f,month).rows.get(m.memberId),g=row?.effectivePersonal??[...(row?.personalHistory??[])].sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank)||b.month-a.month)[0];if(!g)return;const revoked=row?.person?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.month>=g.month&&h.month<=month&&h.factionId===g.factionId&&h.epochFounderId===g.epochFounderId);return `${g.basis==='FOUNDING'?'开国恩爵 · ':g.basis==='COURT'?'从龙恩爵 · ':'军功爵 · '}本人${row?.effectivePersonal?'受封':'曾封'}${g.factionId===f.factionId?'':g.countryName??''}${NOBLE_NAMES[g.rank]}${revoked?' · 已追夺':''}`;}
export function familyNobleSummary(f:MilitaryFamily,month:number){const p=familyArchive(f,month),period=p.last?.period??1,inPeriod=p.acts.filter(a=>a.kind==='SUCCEEDED'&&(a.period??1)===period).length,holder=p.currentInheritedHolderId&&p.rows.get(p.currentInheritedHolderId);return holder&&holder.inherited?.rank?`${holder.member.name} · 袭${FAMILY_NOBLE_NAMES[holder.inherited.rank]} · 第${period}期／本期第${inPeriod}次承袭`:p.last?.kind==='STARTED'?`第${p.last.period}期 · 本人新爵开立传承`:p.last?.kind==='ENDED'?'旧期承袭已终止（家族历史仍保留）':p.actualSuccessions?'曾有承袭，当前无有效持爵者':'尚未发生爵位承袭';}
export function FamilyTitleBadge({personId,factionId,month}:{personId:string;factionId:string;month:number}){const f=Military.getFamilies().find(f=>f.factionId===factionId&&f.members.some(m=>m.militaryPersonId===personId));if(!f)return null;const m=f.members.find(m=>m.militaryPersonId===personId)!,label=familyMemberNobleLabel(f,m,month);return label?<Typography fontSize=".75rem">家族承袭：{label}（与本人授爵分列）</Typography>:null;}
export default function FamilyNoblePanel({family:f,month}:{family:MilitaryFamily;month:number}){
 const [technical,setTechnical]=useState(false),archive=familyArchive(f,month),acts=archive.acts,periods=familyNoblePeriods(f,month);
 const entries=()=>{const source=familyArchiveSource(month).source,ids=new Set([`${f.familyId}-founded`,...acts.map(a=>a.eventId),...f.members.flatMap(m=>archive.rows.get(m.memberId)?.personalHistory.map(g=>g.eventId)??[]),...(f.renewals??[]).map(r=>`${f.familyId}-${r.memberId}-merit`)]),factions=new Map((Game.Core?.teams??[]).map(t=>[t.name,t]));
 return source.events.filter(e=>ids.has(e.id)&&(e.monthIndex??e.year)<=month).sort((a,b)=>(a.monthIndex??a.year)-(b.monthIndex??b.year)).map(e=>({id:e.id,content:<Typography fontSize=".76rem">{formatWorldDate(e.monthIndex??e.year)}，{formatHistoryEventTitle(e,factions)}</Typography>}));};
 return <><Typography fontSize=".76rem">历{periods.length}期爵位传承 · 实际承袭{archive.actualSuccessions}次。军职、本人授爵和家族承袭分别记载，不传部队或食邑。</Typography>
 <HistoricalEventArchive title="家族沿革" totalCount={acts.length+f.members.reduce((n,m)=>n+(archive.rows.get(m.memberId)?.personalHistory.length??0),0)+1+(f.renewals?.length??0)} entries={entries}/>
 <details onToggle={e=>setTechnical(e.currentTarget.open)}><summary>原始史料与技术依据</summary>{technical&&<>
 {periods.map(p=><Typography key={p.number} fontSize=".72rem">第{p.number}期 · 来源{p.sourceGrantEventId??'尚无已结算权源'} · 实际承袭{p.successions}次{p.endMonth!==undefined?` · ${formatWorldDate(p.endMonth)}终止（${p.endReason==='SUPERSEDED'?'本人更高新爵开立下一期':p.endReason}）`:''}</Typography>)}
 {acts.map(a=><div key={a.eventId}><Typography fontSize=".72rem">{formatWorldDate(a.month)} · {a.eventId} · 正式权源 {a.sourceGrantEventId} · 来源 {a.sourceEventIds.join('、')}</Typography>{a.kind==='ENDED'&&(()=>{const x=explainFamilyTitleEnd(f,a,familyArchiveSource(month).source);return <><Typography fontSize=".75rem">{x.text}</Typography>{x.laterChildren.map(m=><Typography key={m.memberId} fontSize=".75rem">{m.name}推定生于{formatWorldDate(m.bornMonth)}，首次居民入籍及父子登记为{formatWorldDate(m.enteredMonth)}{m.parentDeathMonth!==undefined?`；父亲卒于${formatWorldDate(m.parentDeathMonth)}`:''}。{m.sameMonthAfter?'登记虽在同月，但发生于原结算之后。':'登记晚于原结算。'}不追溯改写爵位。来源：{m.entryEventId}</Typography>)}</>;})()}</div>)}
 </>}</details></>;
}
