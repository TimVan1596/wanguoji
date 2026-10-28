import {useEffect,useMemo,useState} from 'react';
import {Box,Typography} from '@mui/material';
import {useDispatch,useSelector} from 'react-redux';
import {RootState} from '../../../store';
import {setPersonArchiveRequest,setSelectedFactionName,setFactionDetailTab,setRightPanelTab} from '../../../store/rootSlice';
import History from '../../../History/WorldHistory';
import Military from '../../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../../Politics/Dynasty';
import {cityAppanageHistory} from '../../../History/CityAppanageHistory';
import {NOBLE_NAMES} from '../../../Politics/MilitaryNobility';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {resolvePersonArchiveTarget} from '../FactionDetails/PersonArchiveTarget';
import MilitaryArchiveWindow from '../FactionDetails/MilitaryArchiveWindow';
import PersonPortrait from '../FactionDetails/PersonPortrait';
import {appanageStatus,appanageSummary,appanageTimelineLabel,appanagePortrait,type AppanageRelation} from './AppanagePresentation';
const link={background:'none',border:0,color:'inherit',font:'inherit',padding:0,cursor:'pointer'} as const;
export default function CityAppanages({cityId}:{cityId:string}){
 const [revision,setRevision]=useState(()=>History.getRevision()),month=useSelector((s:RootState)=>s.root.worldMonth);
 useEffect(()=>History.subscribeRevision(setRevision),[]);
 const facts=useMemo(()=>cityAppanageHistory(cityId,Military.getPeople(),History.getRecordedEvents(),month),[cityId,month,revision]),byId=new Map(facts.relations.map(r=>[r.grant.record.eventId,r]));
 return <Box data-city-appanages={cityId} sx={{display:'grid',gap:.75,minWidth:0}}>
  <Typography fontSize='.75rem' color='var(--gg-text-muted)'>授邑{facts.grants}次 · 受封{facts.people}人 · 当前{facts.current.length?'有有效食邑':'无有效食邑'}</Typography>
  {!facts.relations.length&&<Typography fontSize='.82rem'>尚无正式授邑记录。</Typography>}
  <MilitaryArchiveWindow ids={facts.relations.map(r=>r.grant.record.eventId)} estimateHeight={142} maxRows={24}>{id=><AppanageCard relation={byId.get(id)!} month={month}/>}</MilitaryArchiveWindow>
 </Box>;
}
function AppanageCard({relation:r,month}:{relation:AppanageRelation;month:number}){
 const [open,setOpen]=useState(false),teams=useSelector((s:RootState)=>s.root.teams),dispatch=useDispatch(),{person,record:a}=r.grant;
 const portrait=appanagePortrait(person,a,teams.find(t=>t.name===a.factionId),month),summary=appanageSummary(r);
 const openPerson=(e:React.MouseEvent)=>{e.stopPropagation();const target={kind:'MILITARY' as const,factionId:a.factionId,id:person.personId};if(!resolvePersonArchiveTarget(target,teams,Dynasty.getAll(),Military.getPeople()))return;dispatch(setPersonArchiveRequest(target));dispatch(setSelectedFactionName(a.factionId));dispatch(setFactionDetailTab('military'));dispatch(setRightPanelTab('faction'));};
 return <Box component='article' data-appanage-grant={a.eventId} onClick={()=>setOpen(v=>!v)} sx={{my:.5,p:1,border:'1px solid var(--gg-border)',borderLeft:`3px solid ${portrait.color===undefined?'var(--gg-border)':'#'+portrait.color.toString(16).padStart(6,'0')}`,borderRadius:1,minWidth:0,overflowWrap:'anywhere'}}>
  <Box sx={{display:'flex',gap:.6,alignItems:'flex-start',minWidth:0}}>
   <button type='button' style={{...link,flexShrink:0}} aria-label={`查看${person.personalName}军政档案`} onClick={openPerson}><PersonPortrait {...portrait} size={34}/></button>
   <Box sx={{flex:1,minWidth:0}}>
    <Box sx={{display:'flex',alignItems:'baseline',gap:.5,flexWrap:'wrap'}}><button type='button' style={{...link,fontWeight:600,fontSize:'.88rem',textAlign:'left'}} onClick={openPerson}>{person.personalName}</button><Typography component='span' fontSize='.7rem' color='var(--gg-text-muted)'>{appanageStatus(r)}</Typography></Box>
    <Typography fontSize='.78rem'>{a.countryName} · {NOBLE_NAMES[a.rank]}</Typography>
    <Typography fontSize='.75rem'>{formatWorldDate(a.month)}—{r.endMonth===undefined?'今':formatWorldDate(r.endMonth)}</Typography>
    <Typography fontSize='.75rem'>授封：{a.rulerTitle}</Typography>
    {summary&&<Typography fontSize='.74rem' color='var(--gg-text-muted)'>{summary}</Typography>}
   </Box>
   <button type='button' style={{...link,padding:'0 2px',flexShrink:0}} aria-label={`${open?'收起':'展开'}${person.personalName}封邑经历`} aria-expanded={open} onClick={e=>{e.stopPropagation();setOpen(v=>!v);}}>{open?'▴':'▾'}</button>
  </Box>
  {open&&<Box sx={{mt:.8,pt:.6,borderTop:'1px solid var(--gg-border)',display:'grid',gap:.4}}>{r.timeline.map(e=><Typography key={e.record.eventId} data-appanage-event={e.record.eventId} fontSize='.75rem'>{formatWorldDate(e.record.month)} · {appanageTimelineLabel(e.record)}{e.record.kind==='GRANTED'||e.record.kind==='ENDED'?` · ${NOBLE_NAMES[e.rank]}`:''}</Typography>)}</Box>}
 </Box>;
}
