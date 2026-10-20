import {useState,type ReactNode} from "react";
import {Box,Typography} from "@mui/material";
import PersonMilestones from "./PersonMilestones";

export function ChronicleSection({title,children}:{title:string;children:ReactNode}){
  return <Box component="section" sx={{mt:1,minWidth:0}}><Typography component="h4" fontWeight="bold" fontSize="0.86rem">{title}</Typography>{children}</Box>;
}
export default function PersonChronicleLayout({title,identity,biographyTitle,biography,milestoneTitle,milestones,milestoneTotal,allMilestones,personKey,governance,assessment,voice,evidence,children}:{
  title:ReactNode;identity?:ReactNode;biographyTitle:string;biography:string[];milestoneTitle:string;
  milestones:Array<{id:string;content:ReactNode}>;milestoneTotal?:number;allMilestones?:()=>Array<{id:string;content:ReactNode}>;personKey?:string;governance?:ReactNode;assessment:string[];voice?:string;evidence:ReactNode;children?:ReactNode;
}){
  return <Box sx={{minWidth:0,overflowWrap:"anywhere"}}>
    {title}{identity}
    <ChronicleSection title={biographyTitle}>{biography.map(line=><Typography key={line} fontSize="0.82rem">{line}</Typography>)}</ChronicleSection>
    <PersonMilestones key={`milestones-${personKey}`} title={milestoneTitle} total={milestoneTotal??milestones.length} selected={milestones} all={allMilestones} />
    {governance}{children}
    {assessment.length>0&&<ChronicleSection title="史评">{assessment.map(line=><Typography key={line} fontSize="0.82rem">{line}</Typography>)}</ChronicleSection>}
    {voice&&<ChronicleSection title="史家曰"><Typography fontSize="0.82rem">{voice}</Typography></ChronicleSection>}
    <LazyEvidence key={`evidence-${personKey}`} evidence={evidence}/>
  </Box>;
}

function LazyEvidence({evidence}:{evidence:ReactNode}){const [open,setOpen]=useState(false);return <details open={open} onToggle={e=>setOpen(e.currentTarget.open)} style={{marginTop:8,minWidth:0}}><summary>详细记录</summary>{open&&evidence}</details>;}
