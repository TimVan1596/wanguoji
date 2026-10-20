import type {ReactNode} from "react";
import {Box,Typography} from "@mui/material";
import HistoricalEventArchive from "./HistoricalEventArchive";

export function ChronicleSection({title,children}:{title:string;children:ReactNode}){
  return <Box component="section" sx={{mt:1,minWidth:0}}><Typography component="h4" fontWeight="bold" fontSize="0.86rem">{title}</Typography>{children}</Box>;
}
export default function PersonChronicleLayout({title,identity,biographyTitle,biography,milestoneTitle,milestones,milestoneTotal,governance,assessment,voice,evidence,children}:{
  title:ReactNode;identity?:ReactNode;biographyTitle:string;biography:string[];milestoneTitle:string;
  milestones:Array<{id:string;content:ReactNode}>;milestoneTotal?:number;governance?:ReactNode;assessment:string[];voice?:string;evidence:ReactNode;children?:ReactNode;
}){
  return <Box sx={{minWidth:0,overflowWrap:"anywhere"}}>
    {title}{identity}
    <ChronicleSection title={biographyTitle}>{biography.map(line=><Typography key={line} fontSize="0.82rem">{line}</Typography>)}</ChronicleSection>
    <HistoricalEventArchive title={milestoneTotal!==undefined&&milestoneTotal>milestones.length?`${milestoneTitle}（精选${milestones.length}条／共${milestoneTotal}条）`:milestoneTitle} entries={milestones} defaultOpen />
    {governance}{children}
    {assessment.length>0&&<ChronicleSection title="史评">{assessment.map(line=><Typography key={line} fontSize="0.82rem">{line}</Typography>)}</ChronicleSection>}
    {voice&&<ChronicleSection title="史家曰"><Typography fontSize="0.82rem">{voice}</Typography></ChronicleSection>}
    <Box component="details" sx={{mt:1,minWidth:0}}><summary>详细记录</summary>{evidence}</Box>
  </Box>;
}
