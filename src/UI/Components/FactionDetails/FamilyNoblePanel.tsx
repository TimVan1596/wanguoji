import {familyNobleAuthorityAt} from '../../../Politics/FamilyNobleSuccession';
import {getRegimeStyleNameAtMonth} from '../../../Simulation/RegimeStyle';
import {useState} from 'react';
import {familyNoblePeriods} from '../../../Politics/FamilyNoblePeriods';
import {formatHistoryEventTitle} from '../../../History/HistoryRenderRules';
import Game from '../../../Game/Game';
import Dynasty from '../../../Politics/Dynasty';
import {Typography} from '@mui/material';
import Military from '../../../Politics/MilitaryCommandRegistry';
import type {MilitaryFamily,MilitaryFamilyMember} from '../../../Politics/MilitaryFamily';
import {FAMILY_NOBLE_NAMES,familyNobleText} from '../../../Politics/FamilyNobleSuccession';
import {NOBLE_NAMES,NOBLE_RANKS} from '../../../Politics/MilitaryNobility';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import HistoricalEventArchive from './HistoricalEventArchive';
import {familyArchive,familyArchiveSource} from './FamilyArchiveSource';
import {explainFamilyTitleEnd} from '../../../Politics/FamilyArchiveProjection';
/** Read-only link to an already-existing political identity, including civilian rebel founders. */
export function familyRoyalMember(m:MilitaryFamilyMember,month:number){for(const d of Dynasty.getAll()){const r=d.rulers.find(r=>r.accessionYear!==undefined&&r.accessionYear<=month&&r.bornYear===m.bornMonth&&(m.sourceUserId!==undefined&&r.residentIdentity?.sourceUserId===m.sourceUserId||m.militaryPersonId&&(r.militaryUsurperIdentity?.personId===m.militaryPersonId||r.militaryIdentity?.personId===m.militaryPersonId)));if(r)return {ruler:r,factionId:d.factionId};}return undefined;}
export function familyMemberNobleLabel(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){
 const archive=familyArchive(f,month),row=archive.rows.get(m.memberId),team=Game.Core?.teams.find(t=>t.name===(row?.inherited?.factionId??f.factionId)),country=(at:number)=>team?getRegimeStyleNameAtMonth(team,at):f.factionId;
 if(row?.inherited?.rank)return `袭${country(month)}${FAMILY_NOBLE_NAMES[row.inherited.rank]}`;
 const former=row?.inheritedHistory.at(-1);if(!former?.rank)return;
 const ended=archive.acts.slice(archive.acts.indexOf(former)+1).find(a=>a.previousMemberId===m.memberId&&(a.period??1)===(former.period??1)),reason=ended?.kind==='SUCCEEDED'?'身故传爵':ended?.reason==='FORFEITED'?'政治处分失效':ended?.reason==='REVOKED'?'原爵追夺':ended?.reason==='REGIME_ENDED'?'原王统终结':ended?.reason==='RANK_EXHAUSTED'?'世降耗尽':ended?.reason==='NO_HEIR'?'身故断袭':ended?.reason==='FOREIGN'?'离国失效':ended?.reason==='POLITICAL_ACCESSION'?'登位终止':ended?.reason==='NEW_MERIT'?'新爵另开期次':'承袭失效';
 return `曾袭${country(former.month)}${FAMILY_NOBLE_NAMES[former.rank]}（${ended?formatWorldDate(ended.month)+'，':''}${reason}）`;
}
export function familyMemberMeritLabel(f:MilitaryFamily,m:MilitaryFamilyMember,month:number){const row=familyArchive(f,month).rows.get(m.memberId),g=row?.effectivePersonal??[...(row?.personalHistory??[])].sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank)||b.month-a.month)[0];if(!g)return;const revoked=row?.person?.honorHistory?.some(h=>h.kind==='REVOKED'&&h.month>=g.month&&h.month<=month&&h.factionId===g.factionId&&h.epochFounderId===g.epochFounderId);return `${g.basis==='CIVIL'?'文治爵 · ':g.basis==='FOUNDING'?'开国恩爵 · ':g.basis==='COURT'?'从龙恩爵 · ':'军功爵 · '}本人${row?.effectivePersonal?'受封':'曾封'}${g.factionId===f.factionId?'':g.countryName??''}${NOBLE_NAMES[g.rank]}${revoked?' · 已追夺':''}`;}
export function familyNobleSummary(f:MilitaryFamily,month:number){
 const periods=familyNoblePeriods(f,month);
 if(!periods.length)return '尚未建立爵脉';
 return `${periods.length}条爵脉 · 有效${periods.filter(act=>act.endMonth===undefined).length}条`;
}
export function FamilyTitleBadge({personId,factionId,month}:{personId:string;factionId:string;month:number}){const f=Military.getFamilies().find(f=>(f.factionId===factionId||familyNobleAuthorityAt(f,month).factionId===factionId)&&f.members.some(m=>m.militaryPersonId===personId));if(!f)return null;const m=f.members.find(m=>m.militaryPersonId===personId)!,label=familyMemberNobleLabel(f,m,month);return label?<Typography fontSize=".75rem">家族承袭：{label}（与本人授爵分列）</Typography>:null;}
export default function FamilyNoblePanel({family:f,month}:{family:MilitaryFamily;month:number}){
 const [technical,setTechnical]=useState(false),archive=familyArchive(f,month),acts=archive.acts,periods=familyNoblePeriods(f,month);
 const entries=()=>{const source=familyArchiveSource(month).source,ids=new Set([`${f.familyId}-founded`,...acts.map(a=>a.eventId),...f.members.flatMap(m=>archive.rows.get(m.memberId)?.personalHistory.map(g=>g.eventId)??[]),...(f.renewals??[]).map(r=>`${f.familyId}-${r.memberId}-merit`)]),factions=new Map((Game.Core?.teams??[]).map(t=>[t.name,t]));
 return source.events.filter(e=>ids.has(e.id)&&(e.monthIndex??e.year)<=month).sort((a,b)=>(a.monthIndex??a.year)-(b.monthIndex??b.year)).map(e=>({id:e.id,content:<Typography fontSize=".76rem">{formatWorldDate(e.monthIndex??e.year)}，{formatHistoryEventTitle(e,factions)}</Typography>}));};
 return <><Typography fontSize=".76rem">{periods.length}条爵脉 · 实际承袭{archive.actualSuccessions}次。</Typography>
 {periods.map(p=>{
  const founder=f.members.find(member=>member.memberId===p.start?.holderMemberId);
  const holder=f.members.find(member=>member.memberId===p.holderMemberId);
  return <details key={p.number}><summary>{founder?.name??f.members[0]?.name}爵脉 · {p.endMonth!==undefined?'已终止':holder?.name??'尚无持爵者'}</summary>
   {p.acts.map(act=><Typography key={act.eventId} fontSize=".75rem">{formatWorldDate(act.month)} · {familyNobleText(f,act)}</Typography>)}
  </details>;
 })}
 <HistoricalEventArchive title="家族沿革" totalCount={acts.length+f.members.reduce((n,m)=>n+(archive.rows.get(m.memberId)?.personalHistory.length??0),0)+1+(f.renewals?.length??0)} entries={entries}/>
 <details onToggle={e=>setTechnical(e.currentTarget.open)}><summary>原始史料与技术依据</summary>{technical&&<>
 {periods.map(p=><Typography key={p.number} fontSize=".72rem">第{p.number}期 · {p.factionId}／{p.epochFounderId} · 来源{p.sourceGrantEventId??'尚无已结算权源'} · 实际承袭{p.successions}次{p.endMonth!==undefined?` · ${formatWorldDate(p.endMonth)}终止（${p.endReason==='SUPERSEDED'?'本人更高新爵开立下一期':p.endReason}）`:''}</Typography>)}
 {acts.map(a=><div key={a.eventId}><Typography fontSize=".72rem">{formatWorldDate(a.month)} · {a.eventId} · 正式权源 {a.sourceGrantEventId} · 来源 {a.sourceEventIds.join('、')}</Typography>{a.kind==='ENDED'&&(()=>{const x=explainFamilyTitleEnd(f,a,familyArchiveSource(month).source);return <><Typography fontSize=".75rem">{x.text}</Typography>{x.laterChildren.map(m=><Typography key={m.memberId} fontSize=".75rem">{m.name}推定生于{formatWorldDate(m.bornMonth)}，首次居民入籍及父子登记为{formatWorldDate(m.enteredMonth)}{m.parentDeathMonth!==undefined?`；父亲卒于${formatWorldDate(m.parentDeathMonth)}`:''}。{m.sameMonthAfter?'登记虽在同月，但发生于原结算之后。':'登记晚于原结算。'}不追溯改写爵位。来源：{m.entryEventId}</Typography>)}</>;})()}</div>)}
 </>}</details></>;
}
