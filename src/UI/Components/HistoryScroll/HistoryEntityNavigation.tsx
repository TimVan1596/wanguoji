import WorldHistory from '../../../History/WorldHistory';
import {explainFamilyTitleEnd} from '../../../Politics/FamilyArchiveProjection';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {useEffect,useState,useContext} from 'react';
import {getFactionDisplayNameAtMonth} from '../../../Simulation/FactionIdentity';
import {ReactReduxContext} from 'react-redux';
import {setSelectedCityId,setSelectedFactionName,setFactionDetailTab,setRightPanelTab,setPersonArchiveRequest} from '../../../store/rootSlice';
import {historyEntityLinks} from '../../../History/HistoryEntityLinks';
import {readCourtCoup} from '../../../History/CourtCoupReading';
import type {WorldEvent} from '../../../History/WorldHistory';
/** Mounted only in expanded event details. No extra buttons on the scrolling list. */
export default function HistoryEntityNavigation({event}:{event:WorldEvent}){
 const context=useContext(ReactReduxContext),dispatch=context?.store.dispatch,[sources,setSources]=useState<{military:typeof import('../../../Politics/MilitaryCommandRegistry').default;dynasty:typeof import('../../../Politics/Dynasty').default;game:typeof import('../../../Game/Game').default;archived:typeof import('../../../Simulation/ArchivedCities').default}>();
 useEffect(()=>{if(!dispatch)return;let live=true;Promise.all([import('../../../Politics/MilitaryCommandRegistry'),import('../../../Politics/Dynasty'),import('../../../Game/Game'),import('../../../Simulation/ArchivedCities')]).then(([military,dynasty,game,archived])=>{if(live)setSources({military:military.default,dynasty:dynasty.default,game:game.default,archived:archived.default});}).catch(()=>{});return ()=>{live=false;};},[dispatch]);
 const core=sources?.game.Core;if(!sources||!core||!dispatch)return null;const Military=sources.military,Dynasty=sources.dynasty;
 const court=readCourtCoup(event),links=historyEntityLinks(event,Military.getFamilies(),Military.getPeople(),Dynasty.getAll(),new Set(core.teams.map(t=>t.name)),new Set([...core.allCities.map(c=>c.id),...sources.archived.list().map(c=>c.id)])).filter(l=>!court||l.target.kind==='FACTION'||l.target.kind==='CITY'||l.target.kind==='FAMILY');
 const family=Military.getFamilies().find(f=>f.familyId===event.metadata?.familyId),act=family?.nobleSuccession?.find(a=>a.eventId===event.id),explanation=family&&act?.kind==='ENDED'?explainFamilyTitleEnd(family,act,{month:core.simulator?.year??event.monthIndex??event.year,people:Military.getPeople(),events:WorldHistory.getRecordedEvents(),dynasties:Dynasty.getAll()}):undefined;
 if(!links.length)return null;
 return <details onClick={e=>e.stopPropagation()}><summary>相关人物与档案</summary>{explanation&&<div>{explanation.text}{explanation.laterChildren.map(m=><p key={m.memberId}>{m.name}推定生于{formatWorldDate(m.bornMonth)}；{formatWorldDate(m.enteredMonth)}才首次入籍并登记父系{m.parentDeathMonth!==undefined?`；父亲卒于${formatWorldDate(m.parentDeathMonth)}`:''}。{m.sameMonthAfter?'登记与结算同月，但原始事件顺序在结算之后。':''}不追溯改变原结算。</p>)}</div>}<div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{links.map((link,i)=><button key={i} type="button" onClick={e=>{e.stopPropagation();const t=link.target;if(t.kind==='CITY'){dispatch(setSelectedCityId(t.id));dispatch(setRightPanelTab('city'));}else if(t.kind==='FACTION'){dispatch(setSelectedFactionName(t.id));dispatch(setFactionDetailTab('overview'));dispatch(setRightPanelTab('faction'));}else{dispatch(setPersonArchiveRequest(t));dispatch(setSelectedFactionName(t.factionId));dispatch(setFactionDetailTab(t.kind==='MILITARY'||t.kind==='FAMILY'?'military':'house'));dispatch(setRightPanelTab('faction'));}}}>{link.label}{link.target.kind==='FACTION'?` · ${getFactionDisplayNameAtMonth(core.teams.find(t=>t.name===link.target.id)!,event.monthIndex??event.year)}`:''}</button>)}</div></details>;
}
