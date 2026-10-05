import { Box, Button, Dialog, DialogContent, DialogTitle, Typography } from "@mui/material";
import { memo, useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useSelector } from "react-redux";
import WorldHistory, {
  formatEventDate,
  WorldEvent,
} from "../../../History/WorldHistory";
import { groupHistoryNarratives } from "../../../History/HistoryNarrativeGrouper";
import {
  getEventFactionIds,
  getFilteredHistoryEvents,
  HistoryFilter,
  HISTORY_RENDER_BATCH,
  formatHistoryEventDescription,
  formatHistoryEventTitle,
  resolveFactionHistoricalName,
  resolveEventFactionColor,
} from "../../../History/HistoryRenderRules";
import { isLandmarkHistoryEvent } from "../../../History/HistorySignificanceRules";
import { colorToString } from "../../../paid/theme";
import WorldEra, { classifyEra, resolveEraDisplayLabel, WorldEra as WorldEraRecord } from "../../../Simulation/WorldEra";
import { formatWorldDate, formatWorldDuration } from "../../../Simulation/WorldTime";
import { RootState } from "../../../store";
import { deriveWorldRecords } from "../../../History/WorldRecords";
import EraAtlasMap from "./EraAtlasMap";
import {
  eraSelectionUIReducer,
  getEventsForEraSelection,
  getSelectedEra,
  initialEraSelectionUIState,
} from "./eraSelection";

const filters: { value: HistoryFilter; label: string }[] = [
  { value: "featured", label: "精选" },
  { value: "all", label: "全部" },
  { value: "war", label: "战争" },
  { value: "politics", label: "政权" },
  { value: "god", label: "上帝" },
];

export default function HistoryScroll() {
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("featured");
  const [expandedId, setExpandedId] = useState<string>();
  const [visibleCount, setVisibleCount] = useState(HISTORY_RENDER_BATCH);
  const [eras, setEras] = useState<WorldEraRecord[]>([]);
  const [eraSelectionUI, dispatchEraSelectionUI] = useReducer(eraSelectionUIReducer, initialEraSelectionUIState);
  const [worldRecordsOpen, setWorldRecordsOpen] = useState(false);
  const [expandedRecordSections, setExpandedRecordSections] = useState<string[]>([]);
  const [dynasties, setDynasties] = useState<import("../../../Politics/Dynasty").Dynasty[]>([]);
  const teams = useSelector((state: RootState) => state.root.teams);
  const worldMonth = useSelector((state: RootState) => state.root.worldMonth);
  const worldPhase = useSelector((state: RootState) => state.root.worldPhase);
  const selectedFactionName = useSelector(
    (state: RootState) => state.root.selectedFactionName
  );
  const [manualFactionFilter, setManualFactionFilter] = useState<string>();

  useEffect(() => WorldHistory.subscribe(setEvents), []);
  useEffect(() => WorldEra.subscribe(setEras), []);
  useEffect(() => {
    let active = true;
    import("../../../Politics/Dynasty").then(({ default: registry }) => {
      if (active) setDynasties(registry.getAll());
    });
    return () => {
      active = false;
    };
  }, [events]);
  useEffect(() => {
    if (
      eraSelectionUI.selectedEraId !== "all" &&
      !eras.some((era) => era.id === eraSelectionUI.selectedEraId)
    ) {
      dispatchEraSelectionUI({ type: "RESET_IF_MISSING", validEraIds: eras.map((era) => era.id) });
    }
  }, [eras, eraSelectionUI.selectedEraId]);
  useEffect(() => {
    setManualFactionFilter(selectedFactionName);
  }, [selectedFactionName]);
  useEffect(() => {
    setVisibleCount(HISTORY_RENDER_BATCH);
    setExpandedId(undefined);
  }, [filter, manualFactionFilter, eraSelectionUI.selectedEraId]);

  const historyLookupSignature = JSON.stringify(teams.map((team) => [
    team.name, team.displayName, team.color,
    team.nameHistory?.map((entry) => [entry.startMonth, entry.endMonth, entry.name]),
    team.cities.map((city) => [city.id, city.name]),
  ]));
  const { cityNames, teamByName, factionColorById } = useMemo(() => ({
    cityNames: teams.flatMap((team) => team.cities.map((city) => city.name)),
    teamByName: new Map(teams.map((team) => [team.name, team])),
    factionColorById: new Map(teams.map((team) => [team.name, team.color])),
  }), [historyLookupSignature]);
  const rulerById = useMemo(
    () => new Map(dynasties.flatMap((dynasty) => dynasty.rulers.map((ruler) => [ruler.id, ruler] as const))),
    [dynasties]
  );
  const factionFilter = manualFactionFilter;
  const selectedEra = useMemo(
    () => getSelectedEra(eras, eraSelectionUI.selectedEraId),
    [eras, eraSelectionUI.selectedEraId]
  );
  const selectEra = (eraId: string) => dispatchEraSelectionUI({ type: "SELECT", eraId });
  const toggleEra = (eraId: string) => dispatchEraSelectionUI({ type: "TOGGLE", eraId });
  const currentEra = useMemo(
    () => eras.find((era) => era.endMonth === undefined),
    [eras]
  );
  const liveClassification = classifyEra(
    teams,
    Math.max(1, teams.reduce((sum, team) => sum + team.blocks.children.size, 0)),
    worldMonth,
    worldPhase,
    currentEra
  );
  const eraCandidate = WorldEra.getCandidateDiagnostics(worldMonth);
  const records = useMemo(
    () => worldRecordsOpen ? deriveWorldRecords(dynasties, teams, events, eras, worldMonth) : [],
    [worldRecordsOpen, dynasties, teams, events, eras, worldMonth]
  );
  const eraFilteredEvents = useMemo(
    () => getEventsForEraSelection(selectedEra, events, (startMonth, endMonth) => WorldHistory.getEventsBetween(startMonth, endMonth)),
    [events, selectedEra]
  );
  const factionFilterDisplay = factionFilter
    ? teamByName.get(factionFilter)?.displayName ?? factionFilter
    : undefined;
  const filteredEvents = useMemo(
    () => getFilteredHistoryEvents(eraFilteredEvents, filter, factionFilter),
    [eraFilteredEvents, filter, factionFilter]
  );
  const eventsForGrouping = useMemo(
    () =>
      filter === "featured"
        ? getFilteredHistoryEvents(eraFilteredEvents, "all", factionFilter)
        : filteredEvents,
    [eraFilteredEvents, factionFilter, filter, filteredEvents]
  );
  const displayEvents = useMemo(
    () => {
      const grouped = groupHistoryNarratives(eventsForGrouping);
      return filter === "featured"
        ? getFilteredHistoryEvents(grouped, "featured", factionFilter)
        : grouped;
    },
    [eventsForGrouping, factionFilter, filter]
  );
  const visibleEvents = useMemo(
    () => displayEvents.slice(0, visibleCount),
    [displayEvents, visibleCount]
  );
  const toggleExpandedEvent = useCallback((eventId: string, canExpand: boolean) => {
    if (canExpand) setExpandedId((current) => current === eventId ? undefined : eventId);
  }, []);
  const loadMoreEvents = useCallback(() => {
    setVisibleCount((count) => count + HISTORY_RENDER_BATCH);
  }, []);

  return (
    <Box
      sx={{
        p: 1,
        height: "100%",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <Typography fontWeight="bold" variant="h5" align="center">
        历史卷轴
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 0.25,
          my: 0.75,
        }}
      >
        {filters.map((item) => (
          <Button
            key={item.value}
            size="small"
            variant={filter === item.value ? "contained" : "outlined"}
            onClick={() => setFilter(item.value)}
            sx={{ minWidth: 0, px: 0.35, py: 0.25, fontSize: "0.72rem" }}
          >
            {item.label}
          </Button>
        ))}
      </Box>
      <EraPicker
        eras={eras}
        selectedEraId={eraSelectionUI.selectedEraId}
        onSelectedEraIdChange={selectEra}
      />
      {currentEra ? (
        <Typography fontSize="0.74rem" color="var(--gg-text-muted)" sx={{ mb: 0.35 }}>
          历史时代已持续 {formatWorldDuration(Math.max(0, worldMonth - currentEra.startMonth))}
          {currentEra.explanation ? ` · 确立时：${currentEra.explanation}` : ""}
          <br />当前格局：{liveClassification?.name ?? "格局转换中 / 天下未定"}
          {eraCandidate ? ` · 候选：${eraCandidate.name}（已持续${formatWorldDuration(eraCandidate.sustainedMonths)} / ${formatWorldDuration(eraCandidate.requiredMonths)}）` : ""}
        </Typography>
      ) : null}
      {eras.length > 0 ? (
        <Box sx={{ mb: 0.8 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => dispatchEraSelectionUI({ type: "TOGGLE_TIMELINE" })}
            sx={{ px: 0, minWidth: 0, fontSize: "0.76rem" }}
          >
            时代脉络 {eraSelectionUI.eraTimelineOpen ? "⌃" : "›"}
          </Button>
          {eraSelectionUI.eraTimelineOpen ? (
            <Box
              sx={{
                display: "grid",
                gap: 0.35,
                maxHeight: "8.5rem",
                overflowY: "auto",
                pr: 0.25,
              }}
            >
              {eras.slice().reverse().map((era) => (
                <Box
                  key={era.id}
                  sx={{
                    borderLeft:
                      era.endMonth === undefined
                        ? "3px solid var(--gg-selected)"
                        : "3px solid var(--gg-border)",
                    pl: 0.65,
                    py: 0.25,
                    background:
                      eraSelectionUI.selectedEraId === era.id
                        ? "rgba(47,111,237,0.08)"
                        : "transparent",
                  }}
                >
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => toggleEra(era.id)}
                    sx={{
                      minWidth: 0,
                      px: 0,
                      py: 0,
                      display: "block",
                      textAlign: "left",
                      color: "inherit",
                    }}
                  >
                    <Typography component="span" fontSize="0.7rem" color="var(--gg-text-muted)" sx={{ display: "block" }}>
                      {formatEraTimelineRange(era)}
                    </Typography>
                    <Typography component="span" fontSize="0.8rem" fontWeight={era.endMonth === undefined ? 700 : 500} sx={{ display: "block" }}>
                      {era.name}
                    </Typography>
                    {era.cohortLabelSnapshot ? (
                      <Typography component="span" fontSize="0.68rem" color="var(--gg-text-muted)" sx={{ display: "block" }}>
                        {resolveEraDisplayLabel(era, teamByName)}主导
                      </Typography>
                    ) : null}
                  </Button>
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
      ) : null}
      {selectedEra ? (
        <Box sx={{ mb: 0.8, border: "1px solid var(--gg-border)", p: 0.65 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0.5 }}>
            <Typography fontSize="0.8rem" fontWeight={700}>{resolveEraDisplayLabel(selectedEra, teamByName)}</Typography>
            <Button
              size="small"
              aria-label="收起时代详情并显示全部时代事件"
              onClick={() => dispatchEraSelectionUI({ type: "CLOSE_DETAIL" })}
              sx={{ minWidth: 0, p: "0 4px", lineHeight: 1.2, flexShrink: 0 }}
            >收起 ×</Button>
          </Box>
          <Typography fontSize="0.7rem" color="var(--gg-text-muted)">
            时代范围：{formatEraTimelineRange(selectedEra)}<br />
            {selectedEra.mapSnapshot
              ? `确立时地图 · ${formatWorldDate(selectedEra.mapSnapshot.capturedMonth)}`
              : "该时代创建于 Era Atlas 之前，无历史地图快照。"}
          </Typography>
          {selectedEra.mapSnapshot ? (
            <>
              <EraAtlasMap snapshot={selectedEra.mapSnapshot} />
              <Typography fontSize="0.68rem" color="var(--gg-text-muted)" sx={{ mt: 0.35 }}>
                主导势力：{selectedEra.dominantFactionIds.map((id) => selectedEra.mapSnapshot?.factionPalette.find((entry) => entry.factionId === id)?.displayName ?? id).join(" · ") || "未记录"}
              </Typography>
              <Button size="small" onClick={() => dispatchEraSelectionUI({ type: "OPEN_MAP" })} sx={{ px: 0, minWidth: 0 }}>查看大图</Button>
              <Dialog open={eraSelectionUI.eraMapOpen} onClose={() => dispatchEraSelectionUI({ type: "CLOSE_MAP" })} fullWidth maxWidth="lg">
                <DialogTitle sx={{ pb: 0.5 }}>
                  {resolveEraDisplayLabel(selectedEra, teamByName)} · 确立时地图 · {formatWorldDate(selectedEra.mapSnapshot.capturedMonth)}
                </DialogTitle>
                <DialogContent>
                  <EraAtlasMap snapshot={selectedEra.mapSnapshot} full />
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                    {selectedEra.mapSnapshot.factionPalette.map((faction) => (
                      <Typography key={faction.factionId} fontSize="0.78rem" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                        <Box component="span" sx={{ width: 12, height: 12, bgcolor: `#${(faction.color >>> 0).toString(16).slice(-6).padStart(6, "0")}`, border: "1px solid #555" }} />
                        {faction.displayName}
                      </Typography>
                    ))}
                  </Box>
                  <Typography fontSize="0.72rem" color="var(--gg-text-muted)" sx={{ mt: 0.5 }}>
                    城市点；金色环为首都。{selectedEra.mapSnapshot.cities.map((city) => city.isCapital ? city.name : undefined).filter(Boolean).join("、")}
                  </Typography>
                </DialogContent>
              </Dialog>
            </>
          ) : null}
        </Box>
      ) : null}
      {(worldRecordsOpen || dynasties.length > 0 || events.length > 0) ? (
        <Box sx={{ mb: 0.8 }}>
          <Button
            size="small"
            variant="text"
            onClick={() => setWorldRecordsOpen((open) => !open)}
            sx={{ px: 0, minWidth: 0, fontSize: "0.76rem" }}
          >
            天下纪录 {worldRecordsOpen ? "⌃" : "›"}
          </Button>
          {worldRecordsOpen ? (
            <Box sx={{ border: "1px solid var(--gg-border)", p: 0.65 }}>
              {([
                ["CORE", "核心纪录", 6],
                ["RULER", "君主奇闻", 4],
                ["POLITY", "政权与城市", 4],
                ["ERA", "时代纪录", 2],
              ] as const).map(([section, title, limit]) => {
                const sectionRecords = records.filter((record) => record.section === section);
                if (!sectionRecords.length) return null;
                const expanded = expandedRecordSections.includes(section);
                const shown = expanded ? sectionRecords : sectionRecords.slice(0, limit);
                return (
                  <Box key={section} sx={{ mb: 0.55 }}>
                    <Typography fontSize="0.73rem" fontWeight={700} color="var(--gg-text)">{title}</Typography>
                    {shown.map((record) => (
                      <Typography key={record.id} fontSize="0.72rem" color="var(--gg-text-muted)" sx={{ overflowWrap: "anywhere" }}>
                        {record.label}：{record.value}{record.detail ? `（${record.detail}）` : ""}
                      </Typography>
                    ))}
                    {sectionRecords.length > limit ? (
                      <Button size="small" onClick={() => setExpandedRecordSections((current) => expanded ? current.filter((item) => item !== section) : [...current, section])} sx={{ px: 0, minHeight: 20, fontSize: "0.68rem" }}>
                        {expanded ? "收起" : `查看全部 ${sectionRecords.length} 项`}
                      </Button>
                    ) : null}
                  </Box>
                );
              })}
            </Box>
          ) : null}
        </Box>
      ) : null}
      {factionFilter ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
            mb: 1,
            px: 1,
            py: 0.5,
            backgroundColor: "var(--gg-panel)",
            border: "1px solid var(--gg-border)",
          }}
        >
          <Typography fontSize="0.82rem">当前筛选：{factionFilterDisplay}</Typography>
          <Button size="small" onClick={() => setManualFactionFilter(undefined)}>
            ×
          </Button>
        </Box>
      ) : null}
      <HistoryEventList
        events={visibleEvents}
        hasMore={visibleEvents.length < displayEvents.length}
        expandedId={expandedId}
        teamByName={teamByName}
        rulerById={rulerById}
        factionColorById={factionColorById}
        cityNames={cityNames}
        onToggleExpanded={toggleExpandedEvent}
        onLoadMore={loadMoreEvents}
        sxHeight={factionFilter ? "calc(100% - 13rem)" : "calc(100% - 10.4rem)"}
      />
    </Box>
  );
}

type HistoryEventListProps = {
  events: WorldEvent[];
  hasMore: boolean;
  expandedId?: string;
  teamByName: Map<string, RootState["root"]["teams"][number]>;
  rulerById: Map<string, import("../../../Politics/Dynasty").Ruler>;
  factionColorById: Map<string, number>;
  cityNames: string[];
  onToggleExpanded: (eventId: string, canExpand: boolean) => void;
  onLoadMore: () => void;
  sxHeight: string;
};

function HistoryEventListContent({
  events,
  hasMore,
  expandedId,
  teamByName,
  rulerById,
  factionColorById,
  cityNames,
  onToggleExpanded,
  onLoadMore,
  sxHeight,
}: HistoryEventListProps) {
  return (
    <Box sx={{ height: sxHeight, overflowY: "auto" }}>
      {events.map((event) => {
        const expanded = expandedId === event.id;
        const actorColor = resolveEventFactionColor(event, factionColorById);
        const eventMonth = event.monthIndex ?? event.year;
        const eventFactionIds = getEventFactionIds(event).filter((name) => teamByName.has(name));
        const eventFactionNames = eventFactionIds.map((id) => resolveFactionHistoricalName(teamByName, id, eventMonth));
        const eventTeamByDisplayName = new Map(teamByName);
        eventFactionIds.forEach((factionId) => {
          const team = teamByName.get(factionId);
          if (team) eventTeamByDisplayName.set(resolveFactionHistoricalName(teamByName, factionId, eventMonth), team);
        });
        const eventTitle = formatHistoryEventTitle(event, teamByName, rulerById);
        const eventDescription = formatHistoryEventDescription(event, teamByName);
        const landmark = isLandmarkHistoryEvent(event);
        const canExpand = event.importance === "major" || Boolean(eventDescription) || Boolean(event.metadata);
        return (
          <Box key={event.id} onClick={() => onToggleExpanded(event.id, canExpand)} sx={{
            py: 0.5, px: 1, mb: 0.5,
            borderLeft: actorColor !== undefined ? `4px solid ${colorToString(actorColor)}` : landmark ? "4px solid #8a5a00" : event.importance === "major" ? "4px solid #d32f2f" : "4px solid rgba(0, 0, 0, 0.2)",
            borderTop: landmark ? "1px solid rgba(138, 90, 0, 0.22)" : "none",
            borderBottom: landmark ? "1px solid rgba(138, 90, 0, 0.22)" : "none",
            backgroundColor: landmark ? "rgba(138, 90, 0, 0.08)" : event.importance === "major" ? "rgba(211, 47, 47, 0.08)" : "transparent",
            cursor: canExpand ? "pointer" : "default",
          }}>
            <Typography fontSize="1rem" fontWeight={landmark || event.importance === "major" ? "bold" : "normal"}>
              {formatEventDate(event)} {landmark ? "◆ " : ""}
              <EventText text={eventTitle} teamByName={eventTeamByDisplayName} factionNames={eventFactionNames} cityNames={cityNames} />
            </Typography>
            {expanded ? <Box sx={{ mt: 0.5 }}>
              {eventDescription ? <Typography fontSize="0.85rem" sx={{ opacity: 0.85 }}><EventText text={eventDescription} teamByName={eventTeamByDisplayName} factionNames={eventFactionNames} cityNames={cityNames} /></Typography> : null}
              <EventDetails event={event} teamByName={eventTeamByDisplayName} factionNames={eventFactionNames} cityNames={cityNames} />
            </Box> : null}
          </Box>
        );
      })}
      {hasMore ? <Button fullWidth size="small" variant="outlined" onClick={onLoadMore} sx={{ my: 1 }}>加载更早历史</Button> : null}
    </Box>
  );
}

const HistoryEventList = memo(HistoryEventListContent, (previous, next) => previous.events === next.events &&
  previous.hasMore === next.hasMore && previous.expandedId === next.expandedId &&
  previous.teamByName === next.teamByName && previous.rulerById === next.rulerById &&
  previous.factionColorById === next.factionColorById && previous.cityNames === next.cityNames &&
  previous.onToggleExpanded === next.onToggleExpanded && previous.onLoadMore === next.onLoadMore &&
  previous.sxHeight === next.sxHeight);

function EraPicker({
  eras,
  selectedEraId,
  onSelectedEraIdChange,
}: {
  eras: WorldEraRecord[];
  selectedEraId: string;
  onSelectedEraIdChange: (id: string) => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        gap: 0.5,
        alignItems: "center",
        mb: 0.35,
        flexWrap: "wrap",
      }}
    >
      <Typography fontSize="0.78rem" color="var(--gg-text-muted)">
        时代
      </Typography>
      <Box
        component="select"
        value={selectedEraId}
        onChange={(event) => onSelectedEraIdChange(String(event.target.value))}
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: "0.78rem",
          border: "1px solid var(--gg-border)",
          background: "var(--gg-panel)",
          color: "inherit",
          py: 0.35,
          px: 0.5,
        }}
      >
        <option value="all">全部时代</option>
        {eras.slice().reverse().map((era) => (
          <option key={era.id} value={era.id}>
            {formatStableEraOption(era)}
          </option>
        ))}
      </Box>
    </Box>
  );
}

function EventDetails({
  event,
  teamByName,
  factionNames,
  cityNames,
}: {
  event: WorldEvent;
  teamByName: Map<string, RootState["root"]["teams"][number]>;
  factionNames: string[];
  cityNames: string[];
}) {
  const lines: string[] = [];
  const metadata = event.metadata;
  const kind = metadata?.historyNarrativeKind;
  const isCapitalTransition = kind === "CAPITAL_TRANSITION" ||
    (event.type === "capital-relocated" && typeof metadata?.previousCapitalName === "string");
  const isCollapse = kind === "FACTION_COLLAPSE" || Boolean(metadata?.groupedEventCount) ||
    event.type === "faction-extinct" || event.type === "faction-exiled" || event.type === "faction-dissolved";
  const isDiplomacySigning = event.type === "truce-signed" || event.type === "non-aggression-signed" || event.type === "alliance-signed";
  if (isDiplomacySigning && metadata) {
    const factionAName = event.factionIds?.[0] ? teamByName.get(event.factionIds[0])?.displayName ?? event.factionIds[0] : "一方";
    const factionBName = event.factionIds?.[1] ? teamByName.get(event.factionIds[1])?.displayName ?? event.factionIds[1] : "另一方";
    const signatories = [
      [metadata.signatoryARole, metadata.signatoryATitle],
      [metadata.signatoryBRole, metadata.signatoryBTitle],
    ].filter((entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string");
    if (signatories.length) {
      const roles = [...new Set(signatories.map(([role]) => role))].join("/");
      lines.push(`签约时${roles}：${signatories.map(([, title]) => title).join("、")}`);
    }
    if (metadata.reason === "WAR_EXHAUSTION_TRUCE") {
      addMetadataLine(lines, metadata.recentBilateralCaptureCount, "近三年双边城邑易手");
      addMetadataLine(lines, metadata.stabilityA, `${factionAName}签约时稳定度`);
      addMetadataLine(lines, metadata.stabilityB, `${factionBName}签约时稳定度`);
    } else if (metadata.reason === "COMMON_THREAT_NON_AGGRESSION" || metadata.reason === "COMMON_THREAT_ALLIANCE") {
      addFactionLine(lines, teamByName, metadata.commonThreatFactionId, "共同强敌");
      addMetadataPercentLine(lines, metadata.territoryShareA, `${factionAName}签约时领土占比`);
      addMetadataPercentLine(lines, metadata.territoryShareB, `${factionBName}签约时领土占比`);
      addMetadataPercentLine(lines, metadata.threatTerritoryShare, "共同强敌领土占比");
      addMetadataTextLine(lines, metadata.preconditionStatus, "前置关系");
      addMetadataLine(lines, metadata.preconditionDurationMonths, "前置关系持续月数");
    }
  } else if (isCapitalTransition && metadata) {
    addMetadataTextLine(lines, metadata.previousCapitalName, "旧都");
    addMetadataTextLine(lines, metadata.newCapitalName ?? event.cityName, "新都");
    const cause = metadata.cause === "CAPITAL_DESTROYED" ? "旧都毁于长期战乱" :
      metadata.cause === "CAPITAL_FALL" ? "旧都失陷" : undefined;
    addMetadataTextLine(lines, cause, "原因");
    addFactionLine(lines, teamByName, metadata.conquerorFactionId, "攻陷者");
    addMetadataTextLine(lines, metadata.rulerName, "君主");
  } else if (isCollapse && metadata) {
    const finalCityName = metadata.finalCityName ?? (metadata.isFinalCityCapture === 1 ? metadata.cityName : undefined);
    if (metadata.isFinalCityCapture === 1 && typeof finalCityName === "string") {
      addMetadataTextLine(lines, finalCityName, "最后据点");
      addFactionLine(lines, teamByName, metadata.conquerorFactionId, "攻灭者");
    }
    addMetadataLine(lines, metadata.populationBefore, "灭亡前人口");
    addMetadataLine(lines, metadata.surrenderedPopulation, "投降人口");
    addMetadataLine(lines, metadata.disbandedPopulation, "解散人口");
    addMetadataLine(lines, metadata.remnantPopulation, "残部人口");
    addMetadataLine(lines, metadata.population, "事件时人口");
    addMetadataLine(lines, metadata.populationCapacity, "事件时承载");
    addMetadataPercentLine(lines, metadata.territoryPercent, "事件时领土");
    addMetadataLine(lines, metadata.cityCount, "事件时城市");
    addMetadataLine(lines, metadata.stability, "事件时稳定");
    addMetadataLine(lines, metadata.duration, "持续年数");
    addMetadataLine(lines, metadata.effectDuration, "继承影响年数");
    addMetadataMultiplierLine(
      lines,
      metadata.populationGrowthMultiplier,
      "人口自然增长"
    );
    addMetadataMultiplierLine(
      lines,
      metadata.loyaltyRecoveryMultiplier,
      "忠诚恢复"
    );
    addMetadataMultiplierLine(
      lines,
      metadata.rebellionRiskMultiplier,
      "叛乱风险"
    );
    addMetadataLine(lines, metadata.cityLoyaltyDelta, "城市忠诚变化");
    addMetadataLine(lines, metadata.immediatePopulation, "立即人口变化");
  } else if (metadata) {
    addMetadataLine(lines, metadata.populationBefore, "灭亡前人口");
    addMetadataLine(lines, metadata.surrenderedPopulation, "投降人口");
    addMetadataLine(lines, metadata.disbandedPopulation, "解散人口");
    addMetadataLine(lines, metadata.remnantPopulation, "残部人口");
  }
  return (
    <>
      {lines.map((line) => (
        <Typography key={line} fontSize="0.82rem" sx={{ opacity: 0.82 }}>
          <EventText
            text={line}
            teamByName={teamByName}
            factionNames={factionNames}
            cityNames={cityNames}
          />
        </Typography>
      ))}
    </>
  );
}

function addMetadataTextLine(lines: string[], value: unknown, label: string) {
  if (typeof value === "string" && value.length > 0) {
    lines.push(`${label}：${value}`);
  }
}

function addFactionLine(
  lines: string[],
  teamByName: Map<string, RootState["root"]["teams"][number]>,
  factionId: unknown,
  label: string
) {
  if (typeof factionId !== "string") return;
  lines.push(`${label}：${teamByName.get(factionId)?.displayName ?? factionId}`);
}

export function formatStableEraOption(era: Pick<WorldEraRecord, "name" | "startMonth" | "endMonth">) {
  const end = era.endMonth ?? undefined;
  const range = `${formatWorldDate(era.startMonth)}～${
    end === undefined ? "今" : formatWorldDate(end)
  }`;
  return `${era.name} · ${range}`;
}

export function formatEraTimelineRange(
  era: Pick<WorldEraRecord, "startMonth" | "endMonth">
) {
  return `${formatWorldDate(era.startMonth)}–${
    era.endMonth === undefined ? "今" : formatWorldDate(era.endMonth)
  }`;
}

function addMetadataPercentLine(
  lines: string[],
  value: string | number | undefined,
  label: string
) {
  if (typeof value === "number") {
    lines.push(`${label}：${value.toFixed(1)}%`);
  }
}

function addMetadataMultiplierLine(
  lines: string[],
  value: string | number | undefined,
  label: string
) {
  if (typeof value === "number") {
    lines.push(`${label}：×${value.toFixed(2)}`);
  }
}

function addMetadataLine(
  lines: string[],
  value: string | number | undefined,
  label: string
) {
  if (value !== undefined) {
    lines.push(`${label}：${value}`);
  }
}

function EventText({
  text,
  teamByName,
  factionNames,
  cityNames,
}: {
  text: string;
  teamByName: Map<string, RootState["root"]["teams"][number]>;
  factionNames: string[];
  cityNames: string[];
}) {
  const names = [
    ...[...new Set(factionNames)].sort((a, b) => b.length - a.length),
    ...[...cityNames].sort((a, b) => b.length - a.length),
  ].filter(Boolean);
  if (names.length === 0) {
    return <>{text}</>;
  }
  const pattern = new RegExp(`(${names.map(escapeRegExp).join("|")})`, "g");
  return (
    <>
      {text.split(pattern).map((part, index) => {
        const team = teamByName.get(part);
        if (team) {
          return (
            <FactionToken
              key={`${part}-${index}`}
              name={part}
              color={team.color}
            />
          );
        }
        if (cityNames.includes(part)) {
          return <CityToken key={`${part}-${index}`} name={part} />;
        }
        return part;
      })}
    </>
  );
}

function FactionToken({ name, color }: { name: string; color: number }) {
  return (
    <Box
      component="span"
      sx={{ color: colorToString(color), fontWeight: "bold" }}
    >
      {name}
    </Box>
  );
}

function CityToken({ name }: { name: string }) {
  return (
    <Box
      component="span"
      sx={{ fontWeight: "bold", textDecoration: "underline" }}
    >
      {name}
    </Box>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
