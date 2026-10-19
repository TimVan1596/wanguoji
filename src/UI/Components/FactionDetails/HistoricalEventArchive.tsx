import { useState, type ReactNode } from "react";

/** Complete scrolling archive. Closed audit sections mount no event rows. */
export default function HistoricalEventArchive({ title, entries, defaultOpen = false }: {
  title: string; entries: Array<{ id: string; content: ReactNode }>; defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  return <details open={expanded} onToggle={e => setExpanded(e.currentTarget.open)}
    style={{ marginTop: 6, minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>
    <summary style={{ cursor: "pointer", fontSize: ".86rem" }}>{title}（{entries.length}条）</summary>
    {expanded && <>
      <div style={{ maxHeight: 300, overflowY: "auto", minWidth: 0 }}>
        {entries.map(entry => <div key={entry.id} style={{ marginTop: 6 }}>{entry.content}</div>)}
        {!entries.length && <span>暂无已核验记录。</span>}
      </div>

    </>}
  </details>;
}
