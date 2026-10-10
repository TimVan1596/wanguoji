import { useEffect, useMemo, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import WorldHistory, { formatEventDate, type WorldEvent, type WorldHistoryStore } from "../../../History/WorldHistory";
import { getHistoryCardFactionView, getHistoryCardPresentation } from "../../../History/HistoryCardPresentation";
import { getEventFactionIds, resolveFactionHistoricalName } from "../../../History/HistoryRenderRules";
import type { WorldEra } from "../../../Simulation/WorldEra";
import type Team from "../../../Components/Team";
import type { Ruler } from "../../../Politics/Dynasty";
import { formatWorldDate } from "../../../Simulation/WorldTime";
import { EventDetails, EventText } from "./HistoryEventDetails";
import { getEraChronicleEnd, subscribeEraChronicle } from "./eraChronicleQuery";
import { queryEraHighlights, isAfterEraSnapshot } from "./eraHighlights";
const emptyFactions = new Map<string, Team>();
export default function EraChronicle({ era, worldMonth, factions = emptyFactions, rulers, store = WorldHistory, onViewAllHistory }: {
  era: WorldEra; worldMonth: number; factions?: Map<string, Team>; rulers?: Map<string, Ruler>; store?: WorldHistoryStore; onViewAllHistory?: (eraId: string) => void;
}) {
  const [revision, setRevision] = useState(() => store.getRevision());
  const [expandedId, setExpandedId] = useState<string>();
  useEffect(() => subscribeEraChronicle(store, (nextRevision, reset) => {
    if (reset) { setExpandedId(undefined); }
    setRevision(nextRevision);
  }), [store]);
  const endMonth = getEraChronicleEnd(era, worldMonth);
  const events = useMemo(() => queryEraHighlights(store, era, endMonth), [store, era, endMonth, revision]);
  return <>
    <Typography fontSize="0.85rem" fontWeight={700}>时代精选</Typography>
    <Typography fontSize="0.68rem" color="text.secondary">时代范围：{formatWorldDate(era.startMonth)}～{formatWorldDate(getEraChronicleEnd(era, worldMonth))}<br />精选覆盖整个时代；地图仅记录快照月份。</Typography>
    {!events.length ? <Typography fontSize="0.75rem" sx={{ mt: 1 }}>本时代暂无符合筛选条件的精选事件</Typography> : null}
    {events.map(event => <EraChronicleEventCard key={event.id} event={event} factions={factions} rulers={rulers} capturedMonth={era.mapSnapshot?.capturedMonth} expandedId={expandedId}
      onToggle={() => setExpandedId(id => id === event.id ? undefined : event.id)} />)}
    <Button size="small" onClick={() => onViewAllHistory?.(era.id)}>查看本时代全部历史</Button>
  </>;
}

export function EraChronicleEventCard({ event, factions, rulers, expandedId, onToggle, capturedMonth }: {
  event: WorldEvent; factions: Map<string, Team>; rulers?: Map<string, Ruler>; expandedId?: string; onToggle: () => void; capturedMonth?: number;
}) {
  const month = event.monthIndex ?? event.year, card = getHistoryCardPresentation(event, expandedId, factions, rulers);
  const view = getHistoryCardFactionView(factions, month), factionNames = getEventFactionIds(event).map(id => resolveFactionHistoricalName(factions, id, month));
  for (const id of getEventFactionIds(event)) { const faction = view.get(id); if (faction) view.set(resolveFactionHistoricalName(factions, id, month), faction); }
  const cityNames = [event.cityName, event.metadata?.finalCityName, event.metadata?.previousCapitalName, event.metadata?.newCapitalName].filter((value): value is string => typeof value === "string");
  return <Box key={event.id} data-history-id={event.id} sx={{ borderBottom: "1px solid var(--gg-border)", py: .75 }}>
    <Button size="small" onClick={onToggle} aria-expanded={card.expanded}
      sx={{ display: "block", textAlign: "left", width: "100%", p: 0, color: "inherit", overflowWrap: "anywhere" }}>
      <Typography component="span" fontSize="0.67rem" color="text.secondary" sx={{ display: "block" }}>{formatEventDate(event)}</Typography>
      <Typography component="span" fontSize="0.78rem"><EventText text={card.title} teamByName={view} factionNames={factionNames} cityNames={cityNames} /></Typography>
    </Button>
    {isAfterEraSnapshot(event, capturedMonth) ? <Typography fontSize="0.65rem" color="text.secondary">地图快照之后</Typography> : null}
    {card.expanded ? <Box sx={{ mt: .5 }}>
      {isAfterEraSnapshot(event, capturedMonth) ? <Typography fontSize="0.7rem" color="text.secondary">此事件发生于地图记录月份之后，地图未反映本事件造成的疆域变化。</Typography> : null}
      {card.description ? <Typography fontSize="0.75rem"><EventText text={card.description} teamByName={view} factionNames={factionNames} cityNames={cityNames} /></Typography> : null}
      <EventDetails event={card.event} teamByName={view} factionNames={factionNames} cityNames={cityNames} />
    </Box> : null}
  </Box>;
}
