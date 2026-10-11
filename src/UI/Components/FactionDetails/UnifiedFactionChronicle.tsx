import { useEffect, useState } from "react";
import type { Dynasty, Ruler } from "../../../Politics/Dynasty";
import type { HistoricalFaction } from "../../../Historiography/FactionHistoriography";
import type { HouseHistoricalFaction } from "../../../Historiography/DynastyHouseHistoriography";
import type { UnifiedChronicle } from "../../../Historiography/UnifiedFactionChronicle";
import { getUnifiedFactionChronicle } from "../../../Historiography/UnifiedFactionChronicleArchive";
import { getHouseAssessments } from "../../../Historiography/DynastyHouseAssessmentArchive";
import WorldHistory from "../../../History/WorldHistory";

export function UnifiedFactionChronicle({ dynasty, faction, factions, worldMonth, rulersForFaction }: {
  dynasty: Dynasty; faction: HistoricalFaction & HouseHistoricalFaction;
  factions: ReadonlyMap<string, HistoricalFaction & HouseHistoricalFaction>; worldMonth: number;
  rulersForFaction?: (id: string) => readonly Ruler[] | undefined;
}) {
  const [, setRevision] = useState(() => WorldHistory.getRevision());
  useEffect(() => WorldHistory.subscribeRevision(setRevision), []);
  const phases = getHouseAssessments(dynasty, faction, factions, worldMonth);
  const article = getUnifiedFactionChronicle(dynasty, faction, factions, worldMonth, phases, rulersForFaction);
  return article ? <UnifiedChronicleText article={article} /> : <small>暂无可核验的国史记录。</small>;
}
export function UnifiedChronicleText({ article }: { article: UnifiedChronicle }) {
  return <section aria-label="国史合传" style={{ minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>
    <h3 style={{ margin: "0.3rem 0", fontSize: "0.95rem" }}>{article.title}</h3>
    <small style={{ color: "var(--gg-text-muted)" }}>{article.range}</small>
    {article.paragraphs.map((text, i) => <p key={i} style={{ margin: "0.5rem 0", fontSize: "0.86rem", lineHeight: 1.8 }}>{text}</p>)}
  </section>;
}
