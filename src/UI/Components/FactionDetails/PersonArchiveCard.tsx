import {personRankTheme} from './PersonRankTheme';
import {useEffect,useRef,type ReactNode} from "react";
import {Box,type SxProps,type Theme} from "@mui/material";

/** Shared chronological row for royal and military archives; the heading is a keyboard-accessible control. */
export default function PersonArchiveCard({heading,portrait,expanded,focusRequest=false,active=false,index=0,identityTone,theme,onSelect,children}:{
  theme?:SxProps<Theme>;identityTone?:'ruler'|'royal-kin';heading:ReactNode;portrait?:ReactNode;expanded:boolean;focusRequest?:boolean|number;active?:boolean;index?:number;onSelect:()=>void;children?:ReactNode;
}){
  const headingRef=useRef<HTMLButtonElement>(null);
  const color=theme&&typeof theme==='object'&&!Array.isArray(theme)?(theme as {color?:unknown}).color:identityTone?personRankTheme('ROYAL').color:undefined;
  const headingInk=typeof color==='string'&&color.startsWith('#')?{'--gg-text':color,'--gg-text-muted':color}:{};
  useEffect(()=>{if(expanded&&focusRequest){headingRef.current?.scrollIntoView?.({block:"nearest"});headingRef.current?.focus({preventScroll:true});}},[expanded,focusRequest]);
  return <Box data-archive-identity={identityTone} sx={{position:"relative",pl:1.5,py:.5,minHeight:88,boxSizing:"border-box",minWidth:0,overflowWrap:"anywhere",
    borderLeft:index===0?"none":"1px solid var(--gg-border)",
    border:expanded?"1px solid var(--gg-selected)":identityTone==='ruler'?"1px solid #a58b58":identityTone==='royal-kin'?"1px solid #91869e66":"1px solid transparent",borderRadius:"var(--gg-radius)",...(identityTone?personRankTheme('ROYAL',undefined,identityTone==='ruler'?1:0):{}),...theme,boxShadow:expanded?'0 0 0 1px var(--gg-selected)':undefined}}>
    <Box sx={{display:"flex",alignItems:"flex-start",gap:1,minHeight:78,minWidth:0,...headingInk}}>{portrait}<Box component="button" ref={headingRef} type="button" aria-expanded={expanded} onClick={onSelect}
      sx={{display:"block",width:"100%",minWidth:0,p:0,border:0,background:"transparent",color:"inherit",font:"inherit",textAlign:"left",cursor:"pointer",fontWeight:active?600:undefined,overflowWrap:"anywhere"}}>{heading}</Box></Box>
    {expanded&&<Box sx={{minWidth:0,color:"var(--gg-text)",backgroundColor:"var(--gg-panel)",borderRadius:"var(--gg-radius)"}}>{children}</Box>}
  </Box>;
}
