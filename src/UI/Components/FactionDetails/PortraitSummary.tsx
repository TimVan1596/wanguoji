import {useState,type ComponentProps} from "react";
import {Box,Button,Popover,Typography} from "@mui/material";
import PersonPortrait from "./PersonPortrait";
/** One existing identity projection, no new record or simulation state. */
export default function PortraitSummary({portrait,name,lines,onFull}:{portrait:ComponentProps<typeof PersonPortrait>;name:string;lines:string[];onFull:()=>void}){
 const [anchor,setAnchor]=useState<HTMLButtonElement|null>(null);
 return <>
  <button type="button" aria-label={`查看${name}人物摘要`} aria-haspopup="dialog" onClick={e=>setAnchor(e.currentTarget)} style={{border:0,padding:0,background:"transparent",cursor:"pointer",flexShrink:0}}><PersonPortrait {...portrait}/></button>
  <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={()=>setAnchor(null)} anchorOrigin={{vertical:"bottom",horizontal:"left"}} transformOrigin={{vertical:"top",horizontal:"left"}}>
   <Box role="dialog" aria-label={`${name}人物摘要`} sx={{p:1.5,width:260,maxWidth:"calc(100vw - 48px)",overflowWrap:"anywhere"}}>
    <Box sx={{display:"flow-root"}}><PersonPortrait {...portrait} size={112}/><Typography fontWeight="bold">{name}</Typography></Box>
    {lines.filter(Boolean).map((line,i)=><Typography key={i} fontSize="0.8rem">{line}</Typography>)}
    {portrait.deceased&&<Typography fontSize="0.76rem">已故</Typography>}
    <Button size="small" onClick={()=>{setAnchor(null);onFull();}}>查看完整档案</Button><Button size="small" onClick={()=>setAnchor(null)}>关闭</Button>
   </Box>
  </Popover>
 </>;
}
