import {militaryPoliticalOutcome} from "../../../Politics/MilitaryPoliticalOutcome";
import {useDispatch} from 'react-redux';
import {setSelectedCityId,setRightPanelTab} from '../../../store/rootSlice';
import {cityAppanageHistory,prepareAppanageHistory} from '../../../History/CityAppanageHistory';
import {useMemo} from 'react';
import MilitaryArchiveWindow from './MilitaryArchiveWindow';
import Dynasty from '../../../Politics/Dynasty';
import {Box,Typography} from '@mui/material';
import Military from '../../../Politics/MilitaryCommandRegistry';
import History from '../../../History/WorldHistory';
import Game from '../../../Game/Game';
import {createMeritRosterProjection,NOBLE_NAMES,NOBLE_RANKS} from '../../../Politics/MilitaryNobility';
import {describeMilitaryOffice} from '../../../Politics/MilitaryOffice';
import {getMilitaryPersonDisplayName} from '../../../Politics/MilitaryPersonIdentity';
import {militaryPortraitContext,royalPortraitContext} from './PortraitPresentation';
import PersonPortrait from './PersonPortrait';
import PersonLifeDates from './PersonLifeDates';
import {formatWorldDate,formatWorldDuration} from '../../../Simulation/WorldTime';
const button={border:0,background:'none',color:'inherit',font:'inherit',padding:0,textDecoration:'underline',cursor:'pointer'} as const;
export {NobleHistory} from "./NobleHistory";
/** A changing top three is an archive view, never a simulation award or an office. */
export default function MeritRoll({factionId,month,onOpen}:{factionId:string;month:number;onOpen:(id:string)=>void}){
 const dispatch=useDispatch();
 const projection=useMemo(()=>createMeritRosterProjection(),[]);
 const {byId,top,grants,grantById,rulersById,rulerOwners}=useMemo(()=>{const people=Military.getPeople(),events=History.getEvents();
  const top=projection.get(people,Military.getFormations(),events,factionId,month).slice(0,3),grants=people.flatMap(person=>(person.nobilityHistory??[]).filter(g=>g.factionId===factionId&&g.month<=month).map(grant=>({person,grant}))).sort((a,b)=>b.grant.month-a.grant.month||a.grant.eventId.localeCompare(b.grant.eventId));
  const dynasties=Dynasty.getAll();return {byId:projection.eventsById(),top,grants,grantById:new Map(grants.map(g=>[g.grant.eventId,g])),rulersById:new Map(dynasties.flatMap(d=>d.rulers.map(r=>[r.id,r] as const))),rulerOwners:new Map(dynasties.flatMap(d=>d.rulers.map(r=>[r.id,d.factionId] as const)))};
 },[factionId,month,History.getRevision(),projection]);
 const prepared=useMemo(()=>prepareAppanageHistory(History.getRecordedEvents()),[History.getRevision()]);
 const appanages=useMemo(()=>{if(!top.some(({person})=>person.appanageHistory?.length))return new Map<string,ReturnType<typeof cityAppanageHistory>['relations']>();return new Map(top.map(({person})=>[person.personId,[...new Set((person.appanageHistory??[]).filter(a=>a.factionId===factionId&&a.month<=month).map(a=>a.cityId))].flatMap(cityId=>cityAppanageHistory(cityId,[person],prepared.events,month,prepared).relations.filter(r=>r.grant.record.factionId===factionId))]));},[top,factionId,month,prepared]);
 const team=Game.Core?.teams.find(t=>t.name===factionId);

 return <Box data-merit-roll sx={{display:'grid',gap:1}}>
  <Typography fontWeight='bold'>历代三杰</Typography><Typography fontSize='.76rem'>按重要攻城、不同取城、真实守城及服役资历排序；普通围城经历不单独入选，排行榜不授予爵位。</Typography>
  {!top.length&&<Typography fontSize='.8rem'>尚无可核验的功臣事迹。</Typography>}
  {top.map(({person:p,merits:m})=>{const representative=m.captureEventIds.map(id=>byId.get(id)).find(e=>e?.cityId&&m.importantCityIds.includes(e.cityId))??byId.get(m.captureEventIds[0])??byId.get(m.defenseEventIds[0]);const highest=(p.nobilityHistory??[]).filter(g=>g.factionId===factionId&&g.month<=month).sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank))[0];const linked=p.politicalRulerId?rulersById.get(p.politicalRulerId):undefined,r=linked&&linked.accessionYear!==undefined&&linked.accessionYear<=month?linked:undefined,rt=r&&Game.Core?.teams.find(t=>t.name===rulerOwners.get(r.id)),outcome=militaryPoliticalOutcome(p,factionId,month,Dynasty.getAll(),[...byId.values()]),portrait=r&&rt&&rt.name===factionId?royalPortraitContext(r,rt,month):militaryPortraitContext(p,factionId,team,month);return <Box key={p.personId} data-merit-person={p.personId} sx={{border:'1px solid var(--gg-border)',p:1,borderRadius:1}}>
   <PersonPortrait personId={p.personId} age={Math.max(0,Math.floor(((p.deathMonth??month)-p.bornMonth)/12))} {...portrait}/>
   <button type='button' style={button} onClick={()=>onOpen(p.personId)}>{getMilitaryPersonDisplayName(p)}</button>
   <Typography fontSize='.8rem'>{describeMilitaryOffice(p,factionId)}{highest?` · 历史最高受封：${highest.countryName}${NOBLE_NAMES[highest.rank]}`:''}</Typography>
   {outcome.length>0&&<Typography fontSize='.78rem'>{outcome.join(' · ')}</Typography>}
   <Typography fontSize='.78rem'>本国服役{formatWorldDuration(m.serviceMonths)}{m.cityIds.length>0?` · 攻克／收复${m.cityIds.length}座不同城邑（取城${m.captures}次）`:''}{m.importantCityIds.length>0?` · 重要攻城${m.importantCityIds.length}城`:''}{m.defendedCityIds.length>0?` · 真实守住${m.defendedCityIds.length}城`:''}{m.siegeEventIds.length>0?` · 长期围城经历${m.siegeEventIds.length}处`:''}</Typography>
   {representative&&<Typography fontSize='.78rem'>代表事迹：{representative.type==='siege-defended'?'守住':'攻克／收复'}{representative.cityName} · {formatWorldDate(representative.monthIndex??representative.year)}</Typography>}
   {(appanages.get(p.personId)??[]).map(r=><Typography key={r.grant.record.eventId} fontSize='.78rem'>{r.state==='ENDED'?'曾食邑':r.state==='LOST'?'食邑（失地）':'食邑'}：<button type='button' style={button} onClick={()=>{dispatch(setSelectedCityId(r.grant.record.cityId));dispatch(setRightPanelTab('city'));}}>{r.grant.record.cityName}</button></Typography>)}
   <PersonLifeDates bornMonth={p.bornMonth} deathMonth={p.deathMonth}/>
  </Box>;})}
  <Typography fontWeight='bold'>历代封爵记录</Typography>{!grants.length&&<Typography fontSize='.8rem'>尚无正式册封。</Typography>}
  <MilitaryArchiveWindow estimateHeight={32} maxRows={64} ids={grants.map(g=>g.grant.eventId)}>{id=>{const {person:p,grant:g}=grantById.get(id)!;return <Typography key={g.eventId} fontSize='.8rem'>{formatWorldDate(g.month)} · <button type='button' style={button} onClick={()=>onOpen(p.personId)}>{g.personalName}</button> · {g.countryName}{NOBLE_NAMES[g.rank]} · 授爵：{g.rulerTitle}</Typography>;}}</MilitaryArchiveWindow>
 </Box>;
}
