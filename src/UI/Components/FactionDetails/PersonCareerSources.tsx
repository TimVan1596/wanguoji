import {Typography} from '@mui/material';
import {createPersonCareerIndex,type PersonCareerIndex} from './PersonCareerTimeline';
import HistoricalEventArchive from './HistoricalEventArchive';
import History from '../../../History/WorldHistory';
import {formatWorldDate} from '../../../Simulation/WorldTime';
/** Mounted only in the single folded evidence section. Public chronology has no per-row audit controls. */
export default function PersonCareerSources({personId,month,milestones,index=createPersonCareerIndex(History.getRecordedEvents())}:{personId:string;month:number;milestones:readonly {id:string;sourceIds?:string[]}[];index?:PersonCareerIndex}){
 const anchors=new Map<string,string>();for(const row of milestones)for(const id of row.sourceIds??[row.id])anchors.set(id,row.id);
 const ids=new Set([...(index.principal.get(personId)??[]),...anchors.keys()]),events=[...ids].map(id=>index.byId.get(id)).filter((e):e is NonNullable<typeof e>=>!!e&&(e.monthIndex??e.year)<=month).sort((a,b)=>index.order.get(a.id)!-index.order.get(b.id)!);
 return <HistoricalEventArchive title="单项史事与来源" totalCount={events.length} entries={()=>events.map(e=>({id:e.id,content:<div data-person-source={e.id}><Typography fontSize=".76rem">{formatWorldDate(e.monthIndex??e.year)} · {e.title}</Typography><Typography fontSize=".72rem">事件 {e.id} · 原始顺序 {index.order.get(e.id)}</Typography>{anchors.has(e.id)&&<button type="button" onClick={event=>{const container=event.currentTarget.closest('[data-person-chronicle]');const locate=()=>Array.from(container?.querySelectorAll<HTMLElement>('[data-person-life-event]')??[]).find(n=>n.dataset.personLifeEvent===anchors.get(e.id));if(!locate())container?.querySelector<HTMLButtonElement>('[data-expand-person-life]')?.click();requestAnimationFrame(()=>locate()?.scrollIntoView({block:'center'}));}}>定位关联年表</button>}<details><summary>原始字段与校验信息</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11}}>{JSON.stringify(e,null,2)}</pre></details></div>}))}/>;
}
