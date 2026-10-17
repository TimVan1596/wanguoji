import React, { useState, type ReactNode } from "react";

/** Presentation pagination only; the complete canonical event set stays with the caller. */
export default function HistoricalEventArchive({ title, entries, defaultOpen = false }: {
  title: string; entries: Array<{ id: string; content: ReactNode }>; defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(entries.length / 8));
  const currentPage = Math.min(page, pageCount - 1);
  return <details open={expanded} onToggle={e => setExpanded(e.currentTarget.open)}
    style={{ marginTop: 6, minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>
    <summary style={{ cursor: "pointer", fontSize: ".86rem" }}>{title}（{entries.length}条）</summary>
    {expanded && <>
      <div style={{ maxHeight: 300, overflowY: "auto", minWidth: 0 }}>
        {entries.slice(currentPage * 8, (currentPage + 1) * 8).map(entry => <div key={entry.id} style={{ marginTop: 6 }}>{entry.content}</div>)}
        {!entries.length && <span>暂无已核验记录。</span>}
      </div>
      {pageCount > 1 && <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: ".78rem" }}>
        <button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>上一页</button>
        <span>{currentPage + 1} / {pageCount}</span>
        <button disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>下一页</button>
      </div>}
    </>}
  </details>;
}
