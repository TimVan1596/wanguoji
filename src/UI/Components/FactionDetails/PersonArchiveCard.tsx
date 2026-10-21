import type {ReactNode} from "react";
import {Box} from "@mui/material";

/** Shared chronological row for royal and military archives; the heading is a keyboard-accessible control. */
export default function PersonArchiveCard({heading,portrait,expanded,active=false,index=0,onSelect,children}:{
  heading:ReactNode;portrait?:ReactNode;expanded:boolean;active?:boolean;index?:number;onSelect:()=>void;children?:ReactNode;
}){
  return <Box sx={{position:"relative",pl:1.5,py:.5,minWidth:0,overflowWrap:"anywhere",
    borderLeft:index===0?"none":"1px solid var(--gg-border)",
    border:expanded?"1px solid var(--gg-selected)":"1px solid transparent",borderRadius:"var(--gg-radius)"}}>
    <Box sx={{display:"flex",alignItems:"flex-start",gap:1,minWidth:0}}>{portrait}<Box component="button" type="button" aria-expanded={expanded} onClick={onSelect}
      sx={{display:"block",width:"100%",minWidth:0,p:0,border:0,background:"transparent",color:"var(--gg-text)",font:"inherit",textAlign:"left",cursor:"pointer",fontWeight:active?600:undefined,overflowWrap:"anywhere"}}>{heading}</Box></Box>
    {expanded&&children}
  </Box>;
}
