import { useState, type ReactNode } from "react";

/** Complete document-flow archive. Closed audit sections mount no event rows. */
export default function HistoricalEventArchive({ title, entries, defaultOpen = false,totalCount }: {
  title: string; entries: Array<{ id: string; content: ReactNode }>|(()=>Array<{id:string;content:ReactNode}>); defaultOpen?: boolean;totalCount?:number;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const count=totalCount??(Array.isArray(entries)?entries.length:0),rows=expanded?(typeof entries==='function'?entries():entries):[];
  return <details open={expanded} onToggle={e => setExpanded(e.currentTarget.open)}
    style={{ marginTop: 6, minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>
    <summary style={{ cursor: "pointer", fontSize: ".86rem" }}>{title}（{Array.isArray(entries)&&count>entries.length?`精选${entries.length}条／共${count}条`:`${count}条`}）</summary>
    {expanded && <>
      <div style={{ minWidth: 0 }}>
        {rows.map(entry => <div key={entry.id} style={{ marginTop: 6 }}>{entry.content}</div>)}
        {!rows.length && <span>暂无已核验记录。</span>}
      </div>

    </>}
  </details>;
}
