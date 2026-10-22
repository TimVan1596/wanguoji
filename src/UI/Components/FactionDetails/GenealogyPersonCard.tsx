import {genealogyCardHeight,GENEALOGY_CARD_WIDTH} from "./genealogyWindow";
import {formatRulerLifeAge} from "./RoyalPresentation";
import { Box, Typography } from "@mui/material";
import type { Ruler } from "../../../Politics/Dynasty";
import { genealogyThemeStyles, type GenealogyNodePresentation } from "./GenealogyNodePresentation";

/** Presentation only. The caller keeps the historical name formatter and bloodline layout. */
export function GenealogyPersonCard({ ruler, displayName, presentation, worldMonth, managedLife=true, compact=false, militaryLabel }: {
  ruler: Ruler; displayName: string; presentation?: GenealogyNodePresentation; worldMonth?:number; managedLife?:boolean; compact?:boolean; militaryLabel?:string;
}) {
  const theme = presentation?.theme ?? "neutral";
  if(compact){
    const line={overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"};
    return <Box data-genealogy-theme={theme} title={[displayName,...presentation?.details??[],militaryLabel].filter(Boolean).join(" · ")} sx={{border:"1px solid",...genealogyThemeStyles[theme],borderRadius:"var(--gg-radius)",boxSizing:"border-box",width:GENEALOGY_CARD_WIDTH,height:genealogyCardHeight(worldMonth!==undefined,!!presentation?.labels.length,!!militaryLabel),px:"8px",py:"6px",textAlign:"center"}}>
      <Typography sx={{...line,fontSize:13,lineHeight:"20px",fontWeight:theme==='neutral'?400:700}}>{displayName}</Typography>
      {worldMonth!==undefined&&<Typography sx={{...line,fontSize:11,lineHeight:"16px"}}>{formatRulerLifeAge(ruler,worldMonth,false,managedLife)}</Typography>}
      {presentation?.labels.length?<Typography sx={{...line,fontSize:11,lineHeight:"16px"}}>{presentation.labels.join(" · ")}</Typography>:null}
      <Typography sx={{...line,fontSize:11,lineHeight:"16px"}}>{ruler.reignOrdinal!==undefined?`第${ruler.reignOrdinal}代`:"宗室"}{ruler.status==='dead'?" · 已故":""}</Typography>
      {militaryLabel&&<Typography sx={{...line,fontSize:11,lineHeight:"16px"}}>{militaryLabel}</Typography>}
    </Box>;
  }
  return <Box data-genealogy-theme={theme} title={presentation?.details.join(" · ")}
    sx={{ border: "1px solid", ...genealogyThemeStyles[theme], borderRadius: "var(--gg-radius)", px: 1,
      py: 0.6, minWidth: 100, maxWidth: 230, overflowWrap: "anywhere" }}>
    <Typography fontSize="0.83rem" fontWeight={theme === "neutral" ? 400 : 700}>{displayName}</Typography>
    {worldMonth!==undefined&&<Typography fontSize="0.75rem">{formatRulerLifeAge(ruler,worldMonth,false,managedLife)}</Typography>}
    {presentation?.labels.length ? <Typography fontSize="0.72rem" sx={{ mt: 0.2 }}>{presentation.labels.join(" · ")}</Typography> : null}
    <Typography fontSize="0.68rem" color="var(--gg-text-muted)">
      {ruler.reignOrdinal !== undefined ? `第${ruler.reignOrdinal}代` : presentation?.roles.includes("储君") ? "继承候选" : "宗室成员"}
      {ruler.status === "exiled" ? " · 流亡承统" : ruler.status === "politically-ended" ? " · 生死未载" : ruler.status === "deposed" ? " · 在位时被废，生存未终" : ""}
    </Typography>
  </Box>;
}
