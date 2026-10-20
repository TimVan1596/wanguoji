import { useState, type ReactNode } from "react";

/** Complete document-flow archive. Closed audit sections mount no event rows. */
export default function HistoricalEventArchive({ title, entries, defaultOpen = false,totalCount }: {
  title: string; entries: Array<{ id: string; content: ReactNode }>; defaultOpen?: boolean;totalCount?:number;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  return <details open={expanded} onToggle={e => setExpanded(e.currentTarget.open)}
    style={{ marginTop: 6, minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>
    <summary style={{ cursor: "pointer", fontSize: ".86rem" }}>{title}（{totalCount!==undefined&&totalCount>entries.length?`精选${entries.length}条／共${totalCount}条`:`${entries.length}条`}）</summary>
    {expanded && <>
      <div style={{ minWidth: 0 }}>
        {entries.map(entry => <div key={entry.id} style={{ marginTop: 6 }}>{entry.content}</div>)}
        {!entries.length && <span>暂无已核验记录。</span>}
      </div>

    </>}
  </details>;
}
