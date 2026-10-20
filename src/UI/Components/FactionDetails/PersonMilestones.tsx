import {useState,type ReactNode} from "react";
export type ChronicleRow={id:string;content:ReactNode};
/** Public reading flow, independent of character selection, map focus and audit details. */
export default function PersonMilestones({title,selected,total,all}:{title:string;selected:ChronicleRow[];total:number;all?:()=>ChronicleRow[]}){
 const [expanded,setExpanded]=useState(false);
 const canExpand=Boolean(all&&total>8);
 const rows=all&&(expanded||total<=8)?all():selected;
 return <section style={{marginTop:6,minWidth:0,overflowWrap:"anywhere"}}>
  <h4 style={{fontSize:".86rem",margin:"6px 0"}}>{`${title}（${canExpand&&!expanded?`精选${rows.length}条／共${total}条`:`${rows.length}条`}）`}</h4>
  {rows.map(r=><div key={r.id} style={{marginTop:6}}>{r.content}</div>)}
  {!rows.length&&<span>暂无记载。</span>}
  {canExpand&&<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)} style={{marginTop:8,font:"inherit",fontSize:".82rem",color:"var(--gg-text)",background:"transparent",border:"1px solid var(--gg-border)",cursor:"pointer",maxWidth:"100%"}}>{expanded?"收起至精选8条":`展开全部（共${total}条）`}</button>}
 </section>;
}
