import type {ReactNode} from "react";
/** Collapsed evidence stays available without putting internal identifiers in narrative prose. */
export default function HistoricalEvidence({eventId,source,commandId,personId,children}:{eventId:string;source?:string;commandId?:string;personId?:string;children?:ReactNode}){
  return <details onClick={e=>e.stopPropagation()} style={{fontSize:"0.72rem",overflowWrap:"anywhere",marginTop:3}}>
    <summary>史料依据</summary>
    <div style={{maxHeight:128,overflowY:"auto"}}>原事件：{eventId}{source&&<div>来源：{source}</div>}{commandId&&<div>编组：{commandId}</div>}{personId&&<div>人物：{personId}</div>}{children}</div>
  </details>;
}
