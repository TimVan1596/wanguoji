import {Typography} from "@mui/material";
import type {WorldEvent} from "../../History/WorldHistory";
import {depositionSelectionLines} from "../../Politics/DepositionSelectionPresentation";
export default function DepositionSelectionDetails({event}:{event:WorldEvent}){
 const lines=depositionSelectionLines(event);
 return lines.length?<details onClick={e=>e.stopPropagation()} style={{overflowWrap:"anywhere",fontSize:"0.75rem"}}><summary>史料依据（废立继任选择）</summary>{lines.map((line,i)=><Typography key={i} fontSize="0.75rem">{line}</Typography>)}</details>:null;
}
