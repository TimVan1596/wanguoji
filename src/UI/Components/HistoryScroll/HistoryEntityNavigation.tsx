import {getFactionDisplayNameAtMonth} from '../../../Simulation/FactionIdentity';
import {useDispatch} from 'react-redux';
import {setSelectedCityId,setSelectedFactionName,setFactionDetailTab,setRightPanelTab,setPersonArchiveRequest} from '../../../store/rootSlice';
import Military from '../../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../../Politics/Dynasty';
import Game from '../../../Game/Game';
import {historyEntityLinks} from '../../../History/HistoryEntityLinks';
import {readCourtCoup} from '../../../History/CourtCoupReading';
import type {WorldEvent} from '../../../History/WorldHistory';
/** Mounted only in expanded event details. No extra buttons on the scrolling list. */
export default function HistoryEntityNavigation({event}:{event:WorldEvent}){
 const dispatch=useDispatch(),core=Game.Core;if(!core)return null;
 const court=readCourtCoup(event),links=historyEntityLinks(event,Military.getFamilies(),Military.getPeople(),Dynasty.getAll(),new Set(core.teams.map(t=>t.name)),new Set(core.allCities.map(c=>c.id))).filter(l=>!court||l.target.kind==='FACTION'||l.target.kind==='CITY'||l.target.kind==='FAMILY');
 if(!links.length)return null;
 return <details onClick={e=>e.stopPropagation()}><summary>相关人物与档案</summary><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{links.map((link,i)=><button key={i} type="button" onClick={e=>{e.stopPropagation();const t=link.target;if(t.kind==='CITY'){dispatch(setSelectedCityId(t.id));dispatch(setRightPanelTab('city'));}else if(t.kind==='FACTION'){dispatch(setSelectedFactionName(t.id));dispatch(setFactionDetailTab('overview'));dispatch(setRightPanelTab('faction'));}else{dispatch(setPersonArchiveRequest(t));dispatch(setSelectedFactionName(t.factionId));dispatch(setFactionDetailTab(t.kind==='MILITARY'||t.kind==='FAMILY'?'military':'house'));dispatch(setRightPanelTab('faction'));}}}>{link.label}{link.target.kind==='FACTION'?` · ${getFactionDisplayNameAtMonth(core.teams.find(t=>t.name===link.target.id)!,event.monthIndex??event.year)}`:''}</button>)}</div></details>;
}
