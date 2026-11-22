import {formatPersonYearSpan,formatWorldYearLabel} from '../../../Simulation/WorldTime';
import {resolvePersonTheme,royalThemeIdentity} from './PersonRankTheme';
import GenealogyCardFrame from './GenealogyCardFrame';
import {ROYAL_HONOR_NAMES} from '../../../Politics/RoyalHonors';
import {genealogyCardHeight} from "./genealogyWindow";
import {formatRulerLifeAge} from "./RoyalPresentation";
import { Box, Typography } from "@mui/material";
import type { Ruler } from "../../../Politics/Dynasty";
import { type GenealogyNodePresentation } from "./GenealogyNodePresentation";

/** Presentation only. The caller keeps the historical name formatter and bloodline layout. */
export function GenealogyPersonCard({ ruler, displayName, presentation, worldMonth, managedLife=true, compact=false, militaryLabel }: {
  ruler: Ruler; displayName: string; presentation?: GenealogyNodePresentation; worldMonth?:number; managedLife?:boolean; compact?:boolean; militaryLabel?:string;
}) {
  const lifeLine=worldMonth===undefined?'':`${formatPersonYearSpan(ruler.bornYear,ruler.deathMonth!==undefined&&ruler.deathMonth<=worldMonth?ruler.deathMonth:undefined)} · ${formatRulerLifeAge(ruler,worldMonth,false,managedLife)}`;
  const reignLine=presentation?.reignSummary??(ruler.accessionYear===undefined?'':`在位${formatWorldYearLabel(ruler.accessionYear)}～${ruler.endYear===undefined?'今':formatWorldYearLabel(ruler.endYear)}`);
  const theme = presentation?.theme ?? 'neutral';
  const nobleStyle=resolvePersonTheme({...royalThemeIdentity(ruler,worldMonth??Infinity,{currentRulerId:presentation?.roles.includes('当前君主')?ruler.id:undefined,designatedHeirId:presentation?.roles.includes('储君')?ruler.id:undefined,heirIds:presentation?.details.includes('宗室候选')?[ruler.id]:[]}),sanction:theme==='disqualified',noble:presentation?.nobleTheme,officeKind:presentation?.officeKind,officeLevel:presentation?.officeLevel});

  const honor=ruler.royalHonors?.filter(g=>g.month<=(worldMonth??Infinity)).at(-1);
  const posthumous=presentation?.posthumousLabels?.length?presentation.posthumousLabels.join(' · '):undefined;
  const kinLine=presentation?.honor?.secondary??(honor?(presentation?.details.find(line=>line.startsWith(ROYAL_HONOR_NAMES[honor.rank]))??`${ROYAL_HONOR_NAMES[honor.rank]}（历史荣衔）`):'宗室');
  if(compact){
    const line={overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"};
    return <GenealogyCardFrame data-genealogy-theme={theme} title={[displayName,...presentation?.details??[],militaryLabel].filter(Boolean).join(" · ")} sx={{border:"1px solid",...nobleStyle,borderRadius:"var(--gg-radius)",boxSizing:"border-box",height:genealogyCardHeight(worldMonth!==undefined,!!presentation?.labels.length,!!militaryLabel),px:"8px",py:"6px",textAlign:"center"}}>
      <Typography sx={{...line,fontSize:13,lineHeight:"20px",fontWeight:theme==='neutral'?400:700}}>{presentation?.heading??presentation?.honor?.primary??displayName}</Typography>
      {worldMonth!==undefined&&<Typography sx={{...line,fontSize:11,lineHeight:"16px"}}>{lifeLine}</Typography>}
      {presentation?.labels.length?<Typography sx={{...line,fontSize:11,lineHeight:"16px"}}>{presentation.labels.join(" · ")}</Typography>:null}
      <Typography sx={{...line,fontSize:11,lineHeight:"16px"}}>{reignLine||posthumous||(ruler.reignOrdinal!==undefined?kinLine!=='宗室'?kinLine:`第${ruler.reignOrdinal}任君主`:kinLine)}</Typography>
      {militaryLabel&&<Typography sx={{...line,fontSize:11,lineHeight:"16px"}}>{militaryLabel}</Typography>}
    </GenealogyCardFrame>;
  }
  return <Box data-genealogy-theme={theme} title={presentation?.details.join(" · ")}
    sx={{ border: "1px solid", ...nobleStyle, borderRadius: "var(--gg-radius)", px: 1,
      py: 0.6, minWidth: 100, maxWidth: 230, overflowWrap: "anywhere" }}>
    <Typography fontSize="0.83rem" fontWeight={theme === "neutral" ? 400 : 700}>{presentation?.heading??presentation?.honor?.primary??displayName}</Typography>
    {worldMonth!==undefined&&<Typography fontSize="0.75rem">{lifeLine}</Typography>}
    {presentation?.labels.length ? <Typography fontSize="0.72rem" sx={{ mt: 0.2 }}>{presentation.labels.join(" · ")}</Typography> : null}
    {reignLine&&<Typography fontSize=".72rem">{reignLine}</Typography>}
    {posthumous&&<Typography fontSize=".72rem">{posthumous}</Typography>}
    {militaryLabel&&<Typography fontSize="0.72rem">宗室将领 · {militaryLabel}</Typography>}
    <Typography fontSize="0.68rem" color="var(--gg-text-muted)">
      {ruler.reignOrdinal !== undefined ? `第${ruler.reignOrdinal}任君主` : presentation?.roles.includes("储君") ? "继承候选" : honor?kinLine:"宗室成员"}
      {ruler.status === "exiled" ? " · 流亡承统" : ruler.status === "politically-ended" ? " · 生死未载" : ruler.status === "deposed" ? " · 在位时被废，生存未终" : ""}
    </Typography>
  </Box>;
}
