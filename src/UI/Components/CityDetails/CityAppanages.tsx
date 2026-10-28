import {useEffect,useMemo,useState} from 'react';
import {Box,Typography} from '@mui/material';
import {useDispatch,useSelector} from 'react-redux';
import {RootState} from '../../../store';
import {setPersonArchiveRequest,setSelectedFactionName,setFactionDetailTab,setRightPanelTab} from '../../../store/rootSlice';
import History from '../../../History/WorldHistory';
import Military from '../../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../../Politics/Dynasty';
import {cityAppanageHistory} from '../../../History/CityAppanageHistory';
import {appanageText} from '../../../Politics/MilitaryAppanage';
import {NOBLE_NAMES} from '../../../Politics/MilitaryNobility';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {resolvePersonArchiveTarget} from '../FactionDetails/PersonArchiveTarget';
import MilitaryArchiveWindow from '../FactionDetails/MilitaryArchiveWindow';
export default function CityAppanages({cityId}:{cityId:string}){
 const [open,setOpen]=useState(false),[revision,setRevision]=useState(()=>History.getRevision()),dispatch=useDispatch(),month=useSelector((s:RootState)=>s.root.worldMonth),teams=useSelector((s:RootState)=>s.root.teams);
 useEffect(()=>History.subscribeRevision(setRevision),[]);
 const facts=useMemo(()=>cityAppanageHistory(cityId,Military.getPeople(),History.getRecordedEvents(),month),[cityId,month,revision]);
 const byId=new Map(facts.entries.map(e=>[e.record.eventId,e]));
 return <Box data-city-appanages={cityId} sx={{mt:1}}><button type='button' aria-expanded={open} onClick={()=>setOpen(v=>!v)} style={{background:'none',border:0,color:'inherit',font:'inherit',padding:0,cursor:'pointer'}}>历代封邑：授邑{facts.grants}次 · 受封{facts.people}人 · 当前{facts.current.length?'有有效食邑':'无有效食邑'} {open?'▴':'▾'}</button>
 {open&&<><Typography fontSize='.76rem'>名义食邑，不改变城市归属、人口、城防及军权；进爵不重复计为授邑。</Typography>{!facts.entries.length&&<Typography fontSize='.8rem'>尚无可核验的正式食邑记录。</Typography>}
 <MilitaryArchiveWindow ids={facts.entries.map(e=>e.record.eventId)} estimateHeight={100} maxRows={32}>{id=>{const {person,record:a,rank}=byId.get(id)!;return <Box sx={{py:.7}} data-appanage-event={id}>
  <Typography fontSize='.8rem'>{formatWorldDate(a.month)} · <button type='button' style={{border:0,background:'none',color:'inherit',font:'inherit',padding:0,textDecoration:'underline',cursor:'pointer'}} onClick={()=>{const target={kind:'MILITARY' as const,factionId:a.factionId,id:person.personId};if(!resolvePersonArchiveTarget(target,teams,Dynasty.getAll(),Military.getPeople()))return;dispatch(setPersonArchiveRequest(target));dispatch(setSelectedFactionName(a.factionId));dispatch(setFactionDetailTab('military'));dispatch(setRightPanelTab('faction'));}}>{person.personalName}</button> · 当时{NOBLE_NAMES[rank]}</Typography>
  <Typography fontSize='.78rem'>{appanageText(a)}</Typography><Typography fontSize='.74rem'>授封国：{a.countryName} · 授封君主：{a.rulerTitle}</Typography>
 </Box>;}}</MilitaryArchiveWindow></>}
 </Box>;
}
