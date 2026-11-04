import {useEffect} from 'react';
import {Typography,Button,Box} from '@mui/material';
import Military from '../../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../../Politics/Dynasty';
import Game from '../../../Game/Game';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {usePersonArchiveNavigation} from './PersonArchiveNavigation';
/** Actual canonical duty, not an honorary title or an additional military person. */
export default function InsurgentCommandPanel({factionId,month,rulerId}:{factionId:string;month:number;rulerId?:string}){
 useEffect(()=>()=>Game.Core?.clearMilitaryCommandHighlight(),[factionId,rulerId]);
 const nav=usePersonArchiveNavigation(),commands=Military.getFormations().filter(f=>f.factionId===factionId&&f.leaderDuty&&(!rulerId||f.leaderDuty.rulerId===rulerId));if(!commands.length)return null;
 return <Box>{commands.map(f=>{const d=f.leaderDuty!,r=Dynasty.get(factionId)?.rulers.find(r=>r.id===d.rulerId),current=f.createdMonth<=month&&(d.endMonth??Infinity)>month;if(f.createdMonth>month)return null;return <Box key={f.commandId} sx={{my:.4}}><Typography fontSize=".8rem">{r?`${r.houseName.replace(/氏$/,'')}${r.givenName}`:'历史领袖'} · {current?'实际亲领义军':'曾亲领义军'}（{formatWorldDate(f.createdMonth)}—{d.endMonth!==undefined&&d.endMonth<=month?formatWorldDate(d.endMonth):'今'}）{current?` · 编组${f.memberUnitIds.length}人（含本人）`:''}</Typography>{current&&<Button size="small" onClick={()=>Game.Core?.focusMilitaryFormation(f.commandId)}>查看部队</Button>}{r&&!rulerId&&<Button size="small" onClick={()=>nav.open({kind:'RULER',factionId,id:r.id})}>查看首领本纪</Button>}</Box>;})}</Box>;
}
