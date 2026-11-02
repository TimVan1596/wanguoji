import {MILITARY_OFFICE_NAMES,type MilitaryOffice} from '../../../Politics/MilitaryOffice';
import {useEffect} from 'react';
import {Typography,Button,Box} from '@mui/material';
import Military from '../../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../../Politics/Dynasty';
import History from '../../../History/WorldHistory';
import Game from '../../../Game/Game';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {usePersonArchiveNavigation} from './PersonArchiveNavigation';
import HistoricalEventArchive from './HistoricalEventArchive';
/** Actual canonical duty, not an honorary title or an additional military person. */
export default function InsurgentCommandPanel({factionId,month,rulerId}:{factionId:string;month:number;rulerId?:string}){
 useEffect(()=>()=>Game.Core?.clearMilitaryCommandHighlight(),[factionId,rulerId]);
 const nav=usePersonArchiveNavigation(),commands=Military.getFormations().filter(f=>f.factionId===factionId&&f.leaderDuty&&(!rulerId||f.leaderDuty.rulerId===rulerId));if(!commands.length)return null;
 return <Box>{commands.map(f=>{const d=f.leaderDuty!,r=Dynasty.get(factionId)?.rulers.find(r=>r.id===d.rulerId),team=Game.Core?.teams.find(t=>t.name===factionId),current=f.status==='ACTIVE',target=Game.Core?.allCities.find(c=>c.id===f.targetCityId),events=()=>History.getEventsForFaction(factionId).filter(e=>e.metadata?.commandId===f.commandId&&e.type!=='leader-command-order');return <Box key={f.commandId} sx={{borderLeft:'2px solid var(--gg-accent)',pl:1,my:1}}><Typography fontSize=".82rem">{r?`${r.houseName.replace(/氏$/,'')}${r.givenName}`:'历史领袖'} · {current?'实际统帅':'曾亲领义军'} · {current?`编组${f.memberUnitIds.length}人（含本人）`:`${formatWorldDate(f.createdMonth)}—${formatWorldDate(d.endMonth!)}`}</Typography>{r?.residentIdentity?.military&&<Typography fontSize=".75rem">建势前：{r.residentIdentity.sourceFactionName}{MILITARY_OFFICE_NAMES[r.residentIdentity.military.office as MilitaryOffice]}{current?team?.identityStage==='STATE'?' · 现君主，亲领旧部':' · 现义军首领':''}</Typography>}<Typography fontSize=".75rem">{d.sourceCommandId?'率实际响应旧部接续指挥':'率本势力现有居民成军'}，属于统帅职责，不另授正式军职。{current?target?`正向${target.name}行动。`:'暂无进军目标。':'指挥职责已终止。'}</Typography>{current&&<Typography fontSize=".75rem">成员：{f.memberUnitIds.map(id=>[...(team?.users??[])].find(u=>u.player.logicalUnitId===id)?.id===d.sourceUserId&&r?`${r.houseName.replace(/氏$/,'')}${r.givenName}`:[...(team?.users??[])].find(u=>u.player.logicalUnitId===id)?.name??'身份待核验').join('、')}</Typography>}{current&&<Button size="small" onClick={()=>Game.Core?.focusMilitaryFormation(f.commandId)}>查看部队</Button>}{r&&<Button size="small" onClick={()=>nav.open({kind:'RULER',factionId,id:r.id})}>王室档案</Button>}<HistoricalEventArchive title="指挥与参战记录" totalCount={events().length} entries={()=>events().map(e=>({id:e.id,content:<Typography fontSize=".75rem">{formatWorldDate(e.monthIndex??e.year)} · {e.title}</Typography>}))}/><details><summary>史料依据</summary><Typography fontSize=".7rem">{f.commandId} · 人物 {d.personId} · 建势 {d.foundingEventId} · {formatWorldDate(Math.min(month,f.createdMonth))}起实际指挥；旧军职与旧编组不恢复，战果另据本次部队事件。</Typography></details></Box>;})}</Box>;
}
