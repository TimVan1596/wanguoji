import {familyMemberHeading,familyMemberTitleKind} from '../../../Politics/FamilyMemberHeading';
import FamilyRegisteredChildren from './FamilyRegisteredChildren';
import {familyMemberServiceStatus} from '../../../Politics/FamilyMemberServiceStatus';
import {useEffect,useMemo,useState,useCallback} from 'react';
import {Box,Button,Dialog,DialogContent,DialogTitle,Typography} from '@mui/material';
import {genealogyRulerHeading} from '../../../Politics/GenealogyRulerHeading';
import {familyPoliticalState} from '../../../Politics/FamilyArchiveProjection';
import {militaryPoliticalOutcome} from '../../../Politics/MilitaryPoliticalOutcome';
import {NOBLE_NAMES,NOBLE_RANKS} from '../../../Politics/MilitaryNobility';
import type {MilitaryFamily} from '../../../Politics/MilitaryFamily';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {getFactionDisplayNameAtMonth} from '../../../Simulation/FactionIdentity';
import Game from '../../../Game/Game';
import Military from '../../../Politics/MilitaryCommandRegistry';
import WorldHistory from '../../../History/WorldHistory';
import {militaryMilestones} from '../../../Politics/MilitaryChroniclePresentation';
import {courtServiceReadings} from '../../../Politics/CourtServicePresentation';
import GenealogyTreeView from './GenealogyTreeView';
import GenealogyCardFrame from './GenealogyCardFrame';
import FamilyNoblePanel,{familyMemberNobleLabel,familyNobleSummary,familyMemberMeritLabel} from './FamilyNoblePanel';
import FamilyPersonSources from './FamilyPersonSources';
import {familyArchive,familyArchiveSource,familySummary} from './FamilyArchiveSource';
import {usePersonArchiveNavigation} from './PersonArchiveNavigation';
import {layoutFamilyArchive,projectFamilyTrunk} from './militaryFamilyTree';

const country=(id:string,month:number)=>{const t=Game.Core?.teams.find(t=>t.name===id);return t?getFactionDisplayNameAtMonth(t,month):id;};
/** Read-only adapter model: calculated once per family/world boundary, never per click or zoom. */
export function prepareFamilyTree(family:MilitaryFamily,month:number,requestedMemberId?:string){
 const started=performance.now(),archive=familyArchive(family,month),archiveMs=performance.now()-started,frame=familyArchiveSource(month),{source}=frame;
 const seed=performance.now(),important=new Set(archive.importantIds);if(requestedMemberId&&archive.rows.has(requestedMemberId))important.add(requestedMemberId);const importantMs=performance.now()-seed;
 const trunkAt=performance.now(),projection=projectFamilyTrunk(family.members.filter(m=>m.enteredMonth<=month),important),bridgeMs=performance.now()-trunkAt;
 const byPerson=frame.index!.byPerson,cardsAt=performance.now(),cards=new Map(projection.members.map(m=>{
  const row=archive.rows.get(m.memberId)!,p=row.person,royal=row.political;
  const status=familyMemberServiceStatus(row,month,archive.heirCandidateIds.has(m.memberId),requestedMemberId===m.memberId&&!archive.importantIds.has(m.memberId));
  const politics=p?militaryPoliticalOutcome(p,family.factionId,month,source.dynasties,source.events):[];
  const lines=[`${m.generation===0?'始祖':`第${m.generation+1}代`} · ${row.life==='DEAD'?'已故':row.life==='UNKNOWN'?'生死未载':'在世'} · ${formatWorldDate(m.bornMonth)}生`,politics.length?politics.join(' · '):status,familyMemberMeritLabel(family,m,month),familyMemberNobleLabel(family,m,month)].filter(Boolean) as string[];
  const titleKind=familyMemberTitleKind(row);
  const theme=politics.some(t=>t.includes('禁仕')||t.includes('叛离')||t.includes('伏诛')||t.includes('追夺'))?{borderColor:'#985f59',backgroundColor:'#f7eeee',color:'#7c453f'}:titleKind==='PERSONAL'?{borderColor:'#587f94',backgroundColor:'#eaf1f6',color:'#35566a'}:titleKind==='INHERITED'?{borderColor:'#679077',backgroundColor:'#edf5ef',color:'#406452'}:row.activeOffice?{borderColor:'#638596',backgroundColor:'#eff4f6',color:'#3b5f70'}:{borderColor:'var(--gg-border)',backgroundColor:'var(--gg-panel)',color:'var(--gg-text)'};
  const team=royal&&Game.Core?.teams.find(t=>t.name===royal.factionId),heading=royal&&team?genealogyRulerHeading(royal.r,team,month,undefined,source.events):familyMemberHeading(row,month,country,politics);
  return [m.memberId,{row,status,royal,lines,theme,heading,height:14+20+lines.length*16+(p||royal?24:0)}] as const;
 })),cardsMs=performance.now()-cardsAt,layoutAt=performance.now(),layout=layoutFamilyArchive(projection,new Set(),new Map([...cards].map(([id,c])=>[id,c.height]))),layoutMs=performance.now()-layoutAt;
 const highest=Array.from(archive.rows.values()).flatMap(r=>r.personalHistory).filter(g=>g.factionId===family.factionId&&g.epochFounderId===family.epochFounderId).sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank))[0];
 return {archive,projection,cards,layout,byPerson,highest,source,timing:{archiveMs,importantMs,bridgeMs,cardsMs,layoutMs,totalMs:performance.now()-started}};
}
/** Political history only. Ordinary records remain canonical and can be explicitly located by a source link. */
export default function MilitaryFamilyBrowser({families,worldMonth,onClose,initialFamilyId,initialMemberId}:{families:readonly MilitaryFamily[];worldMonth:number;onClose:()=>void;initialFamilyId?:string;initialMemberId?:string}){
 const [familyId,setFamilyId]=useState(initialFamilyId);
 useEffect(()=>setFamilyId(initialFamilyId),[initialFamilyId]);
 const family=families.find(f=>f.familyId===familyId);
 return <Dialog open fullWidth maxWidth="xl" onClose={onClose} PaperProps={{sx:{width:'90vw',height:'84vh',maxWidth:1500,display:'flex',flexDirection:'column'}}}>
 {family?<FamilyTree key={family.familyId} family={family} month={worldMonth} initialMemberId={family.familyId===initialFamilyId?initialMemberId:undefined} onClose={onClose} onBack={()=>setFamilyId(undefined)}/>:<FamilyOverview families={families} month={worldMonth} onClose={onClose} onOpen={setFamilyId}/>}
 </Dialog>;
}
function FamilyOverview({families,month,onOpen,onClose}:{families:readonly MilitaryFamily[];month:number;onOpen:(id:string)=>void;onClose:()=>void}){
 const [filter,setFilter]=useState('ACTIVE'),[offset,setOffset]=useState(0),frame=familyArchiveSource(month);
 const overview=useMemo(()=>families.map(f=>({f,p:familySummary(f,month)})),[families,frame]);
 const filtered=overview.filter(({p})=>filter==='ALL'||(filter==='ACTIVE'?p.classification==='ACTIVE':p.classification!=='ACTIVE'));
 return <><DialogTitle>功臣世家宗谱<Button onClick={onClose}>关闭</Button></DialogTitle><DialogContent><Typography>关联世家共{families.length}家 · 当前活跃{overview.filter(x=>x.p.classification==='ACTIVE').length}家 · 历史故家{overview.filter(x=>x.p.classification!=='ACTIVE').length}家（其中已无登记在世成员{overview.filter(x=>x.p.classification==='EXTINCT').length}家）。</Typography>
 <Box>{[['ACTIVE','当前活跃世家'],['HISTORICAL','历史故家'],['ALL','全部世家']].map(([id,label])=><Button key={id} variant={filter===id?'contained':'text'} onClick={()=>{setFilter(id);setOffset(0);}}>{label}</Button>)}</Box>
 {!filtered.length&&<Typography>本分类暂无家族；可切换历史故家或全部世家。</Typography>}
 {filtered.slice(offset,offset+12).map(({f,p})=><Box key={f.familyId} sx={{borderBottom:'1px solid var(--gg-border)',py:1}}><Button onClick={()=>onOpen(f.familyId)}>{f.surname}氏 · 始祖{f.members[0].name}</Button><Typography fontSize=".8rem">{country(f.factionId,f.foundedMonth)} · {formatWorldDate(f.foundedMonth)}立家 · {p.generations}代 · 登记{p.members}人 · 历代军政{p.served}人 · {familyPoliticalState(p)} · 登记在世{p.living}人{p.unknown?`，生死未载${p.unknown}人`:''}</Typography></Box>)}
 {filtered.length>12&&<><Button disabled={!offset} onClick={()=>setOffset(Math.max(0,offset-12))}>上一页</Button><Button disabled={offset+12>=filtered.length} onClick={()=>setOffset(offset+12)}>下一页</Button></>}
 </DialogContent></>;
}
function FamilyTree({family,month,initialMemberId,onClose,onBack}:{family:MilitaryFamily;month:number;initialMemberId?:string;onClose:()=>void;onBack:()=>void}){
 const nav=usePersonArchiveNavigation(),[memberId,setMemberId]=useState(initialMemberId),[requested,setRequested]=useState(initialMemberId),frame=familyArchiveSource(month);
 const model=useMemo(()=>prepareFamilyTree(family,month,requested),[family,frame,requested]),{archive,cards,layout}=model,founder=family.members[0];
 const selected=memberId?archive.rows.get(memberId):undefined;
 const openMilitary=useCallback((id:string)=>{const p=model.byPerson.get(id);if(p){onClose();nav.open({kind:'MILITARY',factionId:p.appointments.at(-1)?.factionId??family.factionId,id});}},[model,onClose,nav,family]);
 const openRoyal=useCallback((id:string)=>{const r=cards.get(id)?.royal;if(r){onClose();nav.open({kind:'RULER',factionId:r.factionId,id:r.r.id});}},[cards,onClose,nav]);
 const nodes=useMemo(()=>layout.nodes.map(({member:m})=>{const c=cards.get(m.memberId)!;return {id:m.memberId,depth:m.generation,data:{'data-family-member':m.memberId},card:<GenealogyCardFrame title={[c.heading,...c.lines].join(' · ')} height={c.height} sx={c.theme}><button type="button" data-genealogy-card onClick={()=>setMemberId(m.memberId)} style={{border:0,padding:0,background:'none',color:'inherit',cursor:'pointer',width:'100%'}}><Typography sx={{fontSize:13,lineHeight:'20px',fontWeight:600}} noWrap>{c.heading}</Typography>{c.lines.map((line,i)=><Typography key={i} title={line} sx={{fontSize:11,lineHeight:'16px'}} noWrap>{line}</Typography>)}</button>{c.row.person&&<button style={{fontSize:11,background:'none',border:0,color:'inherit',textDecoration:'underline',cursor:'pointer'}} onClick={()=>openMilitary(m.militaryPersonId!)}>人物档案</button>}{c.royal&&<button style={{fontSize:11,background:'none',border:0,color:'inherit',cursor:'pointer'}} onClick={()=>openRoyal(m.memberId)}>王室档案</button>}</GenealogyCardFrame>};}),[layout,cards,openMilitary,openRoyal]);
 return <GenealogyTreeView title={`${family.surname}氏宗谱`} identity={family.familyId} layout={layout} nodes={nodes} focusId={memberId} targetId={initialMemberId} onLocate={id=>{if(!cards.has(id))setRequested(id);setMemberId(id);}} onClose={onClose} onBack={onBack} locations={[{id:founder.memberId,label:'定位始祖'},...(archive.locatableTitleHolderId?[{id:archive.locatableTitleHolderId,label:'定位有效持爵者'}]:[])]}
 summary={<><Typography fontSize=".8rem">{family.surname}氏 · 始祖{founder.name} · 历{Math.max(...family.members.map(m=>m.generation))+1}代{model.highest?` · 最高${NOBLE_NAMES[model.highest.rank]}`:''} · {familyNobleSummary(family,month)} · {familyPoliticalState(archive)}</Typography><FamilyHistorySection family={family} month={month}/></>}
 details={selected&&<Box data-family-member-detail={selected.member.memberId} sx={{mx:2,mb:1,p:1,border:'1px solid var(--gg-border)'}}><Typography fontWeight="bold">{selected.member.name} · 第{selected.member.generation+1}代 · {cards.get(selected.member.memberId)?.status??'已登记居民'}</Typography><Typography fontSize=".78rem">推定生于{formatWorldDate(selected.member.bornMonth)} · {formatWorldDate(selected.member.enteredMonth)}{selected.member.source==='FOUNDER'?'入谱':'居民入籍／父系登记'}{selected.member.deathMonth!==undefined?`，卒于${formatWorldDate(selected.member.deathMonth)}`:''}</Typography><FamilyPersonSources family={family} memberId={selected.member.memberId} month={month}/><FamilyRegisteredChildren key={selected.member.memberId} family={family} memberId={selected.member.memberId} month={month} onLocate={id=>{setRequested(id);setMemberId(id);}}/>{selected.person&&<><FamilyMemberCareer personId={selected.person.personId} month={month}/><Button onClick={()=>openMilitary(selected.person!.personId)}>查看真实军政档案</Button></>}{selected.political&&<Button onClick={()=>openRoyal(selected.member.memberId)}>查看真实王室身份</Button>}<Button onClick={()=>setMemberId(undefined)}>收起资料</Button></Box>}/>;
}
function FamilyMemberCareer({personId,month}:{personId:string;month:number}){const [open,setOpen]=useState(false);return <details open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>本人任官、功勋与政治生涯</summary>{open&&<FamilyCareerRecords personId={personId} month={month}/>}</details>;}
function FamilyCareerRecords({personId,month}:{personId:string;month:number}){
 const person=Military.getPerson(personId)!,entries=militaryMilestones(person,Military.getChronicle(person,month),WorldHistory.getRecordedEvents());
 return <>{courtServiceReadings(person,WorldHistory.getRecordedEvents(),month).map(row=><Typography key={row.eventId} fontSize=".75rem">{formatWorldDate(row.month)} · {row.text}</Typography>)}{entries.map(e=><Typography key={e.eventId} fontSize=".75rem">{formatWorldDate(e.worldMonth)} · {e.text}</Typography>)}</>;
}
function FamilyHistorySection({family,month}:{family:MilitaryFamily;month:number}){const [open,setOpen]=useState(false);return <details open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>家族史料</summary>{open&&<FamilyNoblePanel family={family} month={month}/>}</details>;}
