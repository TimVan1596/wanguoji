import {appanageCareer} from '../../../History/AppanageCareer';
import type {AppanageHistoryIndex} from '../../../History/CityAppanageHistory';
import PersonMilestones from '../FactionDetails/PersonMilestones';
import {useEffect,useMemo,useState} from 'react';
import {Box,Typography} from '@mui/material';
import {useDispatch,useSelector} from 'react-redux';
import {RootState} from '../../../store';
import {setPersonArchiveRequest,setSelectedFactionName,setFactionDetailTab,setRightPanelTab} from '../../../store/rootSlice';
import History from '../../../History/WorldHistory';
import Military from '../../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../../Politics/Dynasty';
import {cityAppanageHistory,prepareAppanageHistory} from '../../../History/CityAppanageHistory';
import {NOBLE_NAMES} from '../../../Politics/MilitaryNobility';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {resolvePersonArchiveTarget} from '../FactionDetails/PersonArchiveTarget';
import MilitaryArchiveWindow from '../FactionDetails/MilitaryArchiveWindow';
import PersonPortrait from '../FactionDetails/PersonPortrait';
import {appanageStatus,appanageSummary,appanageTimelineLabel,appanagePortrait,appanageLatestPortrait,type AppanageRelation} from './AppanagePresentation';
const link={background:'none',border:0,color:'inherit',font:'inherit',padding:0,cursor:'pointer'} as const;
export default function CityAppanages({cityId}:{cityId:string}){
 const [revision,setRevision]=useState(()=>History.getRevision()),month=useSelector((s:RootState)=>s.root.worldMonth);
 useEffect(()=>History.subscribeRevision(setRevision),[]);
 const eventCount=History.getEventCount();
 const prepared=useMemo(()=>prepareAppanageHistory(History.getRecordedEvents()),[revision,eventCount]);
 const facts=useMemo(()=>cityAppanageHistory(cityId,Military.getPeople(),prepared.events,month,prepared),[cityId,month,prepared]);
 return <AppanageCards cityId={cityId} month={month} facts={facts}/>;
}
export function AppanageCards({cityId,month,facts}:{cityId:string;month:number;facts:ReturnType<typeof cityAppanageHistory>}){
 const byId=new Map(facts.relations.map(r=>[r.grant.record.eventId,r]));
 return <Box data-city-appanages={cityId} sx={{display:'grid',gap:.75,minWidth:0}}>
  <Typography fontSize='.75rem' color='var(--gg-text-muted)'>授邑{facts.grants}次 · 受封{facts.people}人 · 当前{facts.current.length?'有有效食邑':'无有效食邑'}</Typography>
  {!facts.relations.length&&<Typography fontSize='.82rem'>尚无正式授邑记录。</Typography>}
  <MilitaryArchiveWindow ids={facts.relations.map(r=>r.grant.record.eventId)} estimateHeight={142} maxRows={24}>{id=><AppanageCard relation={byId.get(id)!} month={month} index={facts.prepared}/>}</MilitaryArchiveWindow>
 </Box>;
}
function AppanageCard({relation:r,month,index}:{relation:AppanageRelation;month:number;index:AppanageHistoryIndex}){
 const [open,setOpen]=useState(false),teams=useSelector((s:RootState)=>s.root.teams),dispatch=useDispatch(),{person,record:a}=r.grant;
 const faction=teams.find(t=>t.name===a.factionId),portrait=appanageLatestPortrait(r,faction,month,index),summary=appanageSummary(r);
 const career=useMemo(()=>open?appanageCareer(r,index,Military.getFormations(),month):undefined,[open,r,index,month]);
 const openPerson=(e:React.MouseEvent)=>{e.stopPropagation();const target={kind:'MILITARY' as const,factionId:a.factionId,id:person.personId};if(!resolvePersonArchiveTarget(target,teams,Dynasty.getAll(),Military.getPeople()))return;dispatch(setPersonArchiveRequest(target));dispatch(setSelectedFactionName(a.factionId));dispatch(setFactionDetailTab('military'));dispatch(setRightPanelTab('faction'));};
 return <Box component='article' data-appanage-grant={a.eventId} onClick={()=>setOpen(v=>!v)} sx={{my:.5,p:1,border:'1px solid var(--gg-border)',borderLeft:`3px solid ${portrait.color===undefined?'var(--gg-border)':'#'+portrait.color.toString(16).padStart(6,'0')}`,borderRadius:1,minWidth:0,overflowWrap:'anywhere'}}>
  <Box sx={{display:'flex',gap:.6,alignItems:'flex-start',minWidth:0}}>
   <button type='button' style={{...link,flexShrink:0}} aria-label={`查看${person.personalName}军政档案`} onClick={openPerson}><PersonPortrait {...portrait} size={34}/></button>
   <Box sx={{flex:1,minWidth:0}}>
    <Box sx={{display:'flex',alignItems:'baseline',gap:.5,flexWrap:'wrap'}}><button type='button' style={{...link,fontWeight:600,fontSize:'.88rem',textAlign:'left'}} onClick={openPerson}>{person.personalName}</button><Typography component='span' fontSize='.7rem' color='var(--gg-text-muted)'>{appanageStatus(r)}</Typography></Box>
    <Typography fontSize='.78rem'>{a.countryName} · {NOBLE_NAMES[portrait.rank]} · {r.state==='ACTIVE'?'有效期内':'末次有效时'}</Typography>
    <Typography fontSize='.75rem'>{formatWorldDate(a.month)}—{r.endMonth===undefined?'今':formatWorldDate(r.endMonth)}</Typography>
    <Typography fontSize='.75rem'>授封：{a.rulerTitle}</Typography>
    {summary&&<Typography fontSize='.74rem' color='var(--gg-text-muted)'>{summary}</Typography>}
   </Box>
   <button type='button' style={{...link,padding:'0 2px',flexShrink:0}} aria-label={`${open?'收起':'展开'}${person.personalName}封邑经历`} aria-expanded={open} onClick={e=>{e.stopPropagation();setOpen(v=>!v);}}>{open?'▴':'▾'}</button>
  </Box>
  {open&&<Box sx={{mt:.8,pt:.6,borderTop:'1px solid var(--gg-border)',display:'grid',gap:.4}}><details><summary>受封时</summary><PersonPortrait {...appanagePortrait(person,a,faction,a.month)} size={40}/><Typography fontSize='.75rem'>{formatWorldDate(a.month)} · {a.countryName} · {NOBLE_NAMES[a.rank]}</Typography></details>{r.timeline.map(e=><Typography key={e.record.eventId} data-appanage-event={e.record.eventId} fontSize='.75rem'>{formatWorldDate(e.record.month)} · {appanageTimelineLabel(e.record)}{e.record.kind==='GRANTED'||e.record.kind==='ENDED'?` · ${NOBLE_NAMES[e.rank]}`:''}</Typography>)}{career&&career.entries.length>0&&<><Typography fontSize='.72rem' color='var(--gg-text-muted)'>以下为人物受封期间的经历，战事地点各据原记录。</Typography><PersonMilestones title='受封期间的军旅与荣誉' total={career.entries.length} selected={career.entries.slice(0,8).map(e=>({id:e.eventId,content:<Typography fontSize='.75rem'>{formatWorldDate(e.worldMonth)} · {e.text}</Typography>}))} all={()=>career.entries.map(e=>({id:e.eventId,content:<Typography fontSize='.75rem'>{formatWorldDate(e.worldMonth)} · {e.text}</Typography>}))}/><details><summary>史料考证</summary>{career.windows.map((w,i)=><Typography key={i} fontSize='.72rem'>有效阶段：{formatWorldDate(w.startMonth)}—{formatWorldDate(w.endMonth)}</Typography>)}{career.entries.map(e=><Typography key={e.eventId} fontSize='.72rem'>人物 {person.personId} · 来源 {(e.sourceEventIds??[e.eventId]).join('、')}</Typography>)}</details></>}</Box>}
 </Box>;
}

export function CityAppanageSection({cityId}:{cityId:string}){
 const [override,setOverride]=useState<boolean|undefined>(),[revision,setRevision]=useState(()=>History.getRevision()),month=useSelector((s:RootState)=>s.root.worldMonth);
 useEffect(()=>History.subscribeRevision(setRevision),[]);
 const summary=useMemo(()=>{const grants=Military.getPeople().flatMap(p=>(p.appanageHistory??[]).filter(a=>a.cityId===cityId&&a.personId===p.personId&&a.kind==='GRANTED'&&a.grantEventId===a.eventId&&a.month<=month));return {grants:new Set(grants.map(a=>a.eventId)).size,people:new Set(grants.map(a=>a.personId)).size};},[cityId,month,revision]);
 const open=override??summary.grants<=5;
 if(!summary.grants)return null;
 return <section data-city-appanage-section={cityId}><button type='button' style={{...link,fontWeight:600}} aria-expanded={open} onClick={()=>setOverride(!open)}>历代封邑 · 授邑{summary.grants}次 · {summary.people}人 {open?'▴':'▾'}</button>{open&&<CityAppanages cityId={cityId}/>}</section>;
}
