import {Box,LinearProgress,Typography} from '@mui/material';
import {personHealth,type PersonAbilities} from '../../../Politics/PersonAbilities';
import {formatWorldDate} from '../../../Simulation/WorldTime';

export interface LoyaltyObservation {value:number;factionName:string;month:number;historical?:boolean;}
const valid=(value:number|undefined):value is number=>value!==undefined&&Number.isFinite(value)&&value>=0&&value<=100;

function Attribute({id,label,value,color}:{id:string;label:string;value?:number;color:string}){
 if(!valid(value))return null;
 return <Box data-person-attribute={id} sx={{display:'flex',alignItems:'center',gap:.75,minWidth:0}}>
  <Typography fontSize=".78rem" sx={{flex:'0 0 3em',whiteSpace:'nowrap'}}>{label}：</Typography>
  <LinearProgress variant="determinate" value={value} aria-label={label} sx={{flex:1,minWidth:24,height:7,borderRadius:1,backgroundColor:'var(--gg-border)','& .MuiLinearProgress-bar':{backgroundColor:color}}}/>
  <Typography fontSize=".78rem" sx={{flex:'0 0 4.8em',textAlign:'right',fontVariantNumeric:'tabular-nums',whiteSpace:'nowrap'}}>{value}/100</Typography>
 </Box>;
}

export default function PersonAbilityPanel({abilities,ambition,loyalty,royal=false,month,deathMonth,lifeUnverified=false}:{abilities?:PersonAbilities;ambition?:number;loyalty?:LoyaltyObservation;royal?:boolean;month?:number;deathMonth?:number;lifeUnverified?:boolean}){
 if(abilities&&month!==undefined&&month<abilities.source.bornMonth)return null;
 const deceased=month!==undefined&&deathMonth!==undefined&&deathMonth<=month;
 const health=abilities&&month!==undefined&&!lifeUnverified?personHealth(abilities.source,month,deathMonth):undefined;
 const relationship=!royal&&loyalty?.factionName&&valid(loyalty.value)&&(!deceased||loyalty.historical)?loyalty:undefined;
 return <Box data-person-abilities={abilities?JSON.stringify(abilities):undefined} sx={{display:'grid',gap:.6,minWidth:0,my:.6}}>
  {abilities?<><Attribute id="strategy" label="文能" value={abilities.strategy} color="#56816b"/><Attribute id="command" label="武力" value={abilities.command} color="#527ba4"/><Attribute id="health" label="健康" value={health} color="#9d6952"/>
   {deceased&&valid(health)&&<Typography fontSize=".72rem" color="var(--gg-text-muted)">卒前状态 · {formatWorldDate(deathMonth!)}</Typography>}
   {lifeUnverified&&<Typography fontSize=".72rem" color="var(--gg-text-muted)">生死未载，健康资料不足</Typography>}
  </>:<Typography fontSize=".78rem" color="var(--gg-text-muted)">能力资料不足</Typography>}
  {(valid(ambition)||relationship)&&<details><summary>政治性格与国家关系</summary>
   <Attribute id="ambition" label="野心" value={ambition} color="#ac793b"/>
   {relationship&&<><Attribute id="loyalty" label="忠诚" value={relationship.value} color="#93636e"/><Typography fontSize=".72rem" color="var(--gg-text-muted)">忠诚对象：{relationship.factionName} · {formatWorldDate(relationship.month)}{relationship.historical?'记录':'当前关系'}</Typography></>}
  </details>}
 </Box>;
}

/** Mounted only inside the existing, closed-by-default biography technical evidence. */
export function PersonAbilityEvidence({abilities}:{abilities:PersonAbilities}){return <Typography fontSize=".74rem">能力版本 {abilities.version} · 来源 {JSON.stringify(abilities.source)}。武力衡量统御与部队组织。健康由年龄与先天体质推算，用于任官和致仕，不直接决定寿命。能力与体质不另抽世界随机数。</Typography>;}
