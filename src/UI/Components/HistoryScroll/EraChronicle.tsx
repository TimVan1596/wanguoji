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
import { getEraChronicleEnd, queryEraChroniclePage, subscribeEraChronicle, type EraChroniclePage } from "./eraChronicleQuery";
const emptyFactions = new Map<string, Team>();
export default function EraChronicle({ era, worldMonth, factions = emptyFactions, rulers, store = WorldHistory }: {
  era: WorldEra; worldMonth: number; factions?: Map<string, Team>; rulers?: Map<string, Ruler>; store?: WorldHistoryStore;
}) {
  const [revision, setRevision] = useState(() => store.getRevision());
  const [olderPage, setOlderPage] = useState<EraChroniclePage>();
  const [expandedId, setExpandedId] = useState<string>();
  useEffect(() => subscribeEraChronicle(store, (nextRevision, reset) => {
    if (reset) { setOlderPage(undefined); setExpandedId(undefined); }
    setRevision(nextRevision);
  }), [store]);
  const endMonth = getEraChronicleEnd(era, worldMonth);
  const page = useMemo(() => olderPage ?? queryEraChroniclePage(store, era, endMonth), [store, era, endMonth, revision, olderPage]);
  return <>
    <Typography fontSize="0.85rem" fontWeight={700}>时代大事</Typography>
    <Typography fontSize="0.68rem" color="text.secondary">时代范围：{formatWorldDate(era.startMonth)}～{formatWorldDate(getEraChronicleEnd(era, worldMonth))}<br />大事属于整个时代；地图仅记录快照月份。</Typography>
    {!page.events.length ? <Typography fontSize="0.75rem" sx={{ mt: 1 }}>本时代暂无符合筛选条件的大事</Typography> : null}
    {page.events.map(event => <EraChronicleEventCard key={event.id} event={event} factions={factions} rulers={rulers} expandedId={expandedId}
      onToggle={() => setExpandedId(id => id === event.id ? undefined : event.id)} />)}
    {page.cursor ? <Button size="small" onClick={() => { setOlderPage(queryEraChroniclePage(store, era, worldMonth, page.cursor)); setExpandedId(undefined); }}>查看更多 · 更早大事</Button> : null}
    {olderPage ? <Button size="small" onClick={() => { setOlderPage(undefined); setExpandedId(undefined); }}>回到最近大事</Button> : null}
  </>;
}

export function EraChronicleEventCard({ event, factions, rulers, expandedId, onToggle }: {
  event: WorldEvent; factions: Map<string, Team>; rulers?: Map<string, Ruler>; expandedId?: string; onToggle: () => void;
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
    {card.expanded ? <Box sx={{ mt: .5 }}>
      {card.description ? <Typography fontSize="0.75rem"><EventText text={card.description} teamByName={view} factionNames={factionNames} cityNames={cityNames} /></Typography> : null}
      <EventDetails event={card.event} teamByName={view} factionNames={factionNames} cityNames={cityNames} />
    </Box> : null}
  </Box>;
}
