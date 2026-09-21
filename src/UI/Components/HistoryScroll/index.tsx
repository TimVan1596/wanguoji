import { Box, Button, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
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
import WorldEra, { classifyEra, WorldEra as WorldEraRecord } from "../../../Simulation/WorldEra";
import { formatWorldDate, formatWorldDuration } from "../../../Simulation/WorldTime";
import { RootState } from "../../../store";

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
  const [selectedEraId, setSelectedEraId] = useState<string>("all");
  const [eraTimelineOpen, setEraTimelineOpen] = useState(false);
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
    if (
      selectedEraId !== "all" &&
      !eras.some((era) => era.id === selectedEraId)
    ) {
      setSelectedEraId("all");
    }
  }, [eras, selectedEraId]);
  useEffect(() => {
    setManualFactionFilter(selectedFactionName);
  }, [selectedFactionName]);
  useEffect(() => {
    setVisibleCount(HISTORY_RENDER_BATCH);
    setExpandedId(undefined);
  }, [filter, manualFactionFilter, selectedEraId]);

  const cityNames = useMemo(
    () => teams.flatMap((team) => team.cities.map((city) => city.name)),
    [teams]
  );
  const teamByName = useMemo(
    () => new Map(teams.map((team) => [team.name, team])),
    [teams]
  );
  const factionColorById = useMemo(
    () => new Map(teams.map((team) => [team.name, team.color])),
    [teams]
  );
  const factionFilter = manualFactionFilter;
  const selectedEra = useMemo(
    () => selectedEraId === "all" ? undefined : eras.find((era) => era.id === selectedEraId),
    [eras, selectedEraId]
  );
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
  const eraFilteredEvents = useMemo(
    () =>
      selectedEra
        ? WorldHistory.getEventsBetween(selectedEra.startMonth, selectedEra.endMonth)
        : events,
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
        selectedEraId={selectedEraId}
        onSelectedEraIdChange={setSelectedEraId}
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
            onClick={() => setEraTimelineOpen((open) => !open)}
            sx={{ px: 0, minWidth: 0, fontSize: "0.76rem" }}
          >
            时代脉络 {eraTimelineOpen ? "⌃" : "›"}
          </Button>
          {eraTimelineOpen ? (
            <Box
              sx={{
                display: "grid",
                gap: 0.35,
                maxHeight: "8.5rem",
                overflowY: "auto",
                pr: 0.25,
              }}
            >
              {eras.map((era) => (
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
                      selectedEraId === era.id
                        ? "rgba(47,111,237,0.08)"
                        : "transparent",
                  }}
                >
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setSelectedEraId(era.id)}
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
                        {era.cohortLabelSnapshot}主导
                      </Typography>
                    ) : null}
                  </Button>
                </Box>
              ))}
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
      <Box
        sx={{
          height: factionFilter ? "calc(100% - 13rem)" : "calc(100% - 10.4rem)",
          overflowY: "auto",
        }}
      >
        {visibleEvents.map((event) => {
          const expanded = expandedId === event.id;
          const actorColor = resolveEventFactionColor(event, factionColorById);
          const eventMonth = event.monthIndex ?? event.year;
          const eventFactionIds = getEventFactionIds(event).filter((name) =>
            teamByName.has(name)
          );
          const eventFactionNames = eventFactionIds.map((factionId) =>
            resolveFactionHistoricalName(teamByName, factionId, eventMonth)
          );
          const eventTeamByDisplayName = new Map(teamByName);
          eventFactionIds.forEach((factionId) => {
            const team = teamByName.get(factionId);
            if (team) {
              eventTeamByDisplayName.set(
                resolveFactionHistoricalName(teamByName, factionId, eventMonth),
                team
              );
            }
          });
          const eventTitle = formatHistoryEventTitle(event, teamByName);
          const eventDescription = formatHistoryEventDescription(event, teamByName);
          const landmark = isLandmarkHistoryEvent(event);
          const canExpand =
            event.importance === "major" ||
            Boolean(eventDescription) ||
            Boolean(event.metadata);
          return (
            <Box
              key={event.id}
              onClick={() =>
                canExpand
                  ? setExpandedId(expanded ? undefined : event.id)
                  : undefined
              }
              sx={{
                py: 0.5,
                px: 1,
                mb: 0.5,
                borderLeft:
                  actorColor !== undefined
                    ? `4px solid ${colorToString(actorColor)}`
                    : landmark
                    ? "4px solid #8a5a00"
                    : event.importance === "major"
                    ? "4px solid #d32f2f"
                    : "4px solid rgba(0, 0, 0, 0.2)",
                borderTop: landmark ? "1px solid rgba(138, 90, 0, 0.22)" : "none",
                borderBottom: landmark ? "1px solid rgba(138, 90, 0, 0.22)" : "none",
                backgroundColor:
                  landmark
                    ? "rgba(138, 90, 0, 0.08)"
                    : event.importance === "major"
                    ? "rgba(211, 47, 47, 0.08)"
                    : "transparent",
                cursor: canExpand ? "pointer" : "default",
              }}
            >
              <Typography
                fontSize="1rem"
                fontWeight={landmark || event.importance === "major" ? "bold" : "normal"}
              >
                {formatEventDate(event)} {landmark ? "◆ " : ""}
                  <EventText
                    text={eventTitle}
                    teamByName={eventTeamByDisplayName}
                    factionNames={eventFactionNames}
                    cityNames={cityNames}
                  />
              </Typography>
              {expanded ? (
                <Box sx={{ mt: 0.5 }}>
                  {eventDescription ? (
                    <Typography fontSize="0.85rem" sx={{ opacity: 0.85 }}>
                      <EventText
                        text={eventDescription}
                        teamByName={eventTeamByDisplayName}
                        factionNames={eventFactionNames}
                        cityNames={cityNames}
                      />
                    </Typography>
                  ) : null}
                  <EventDetails
                    event={event}
                    teamByName={eventTeamByDisplayName}
                    factionNames={eventFactionNames}
                    cityNames={cityNames}
                  />
                </Box>
              ) : null}
            </Box>
          );
        })}
        {visibleEvents.length < displayEvents.length ? (
          <Button
            fullWidth
            size="small"
            variant="outlined"
            onClick={() => setVisibleCount((count) => count + HISTORY_RENDER_BATCH)}
            sx={{ my: 1 }}
          >
            加载更早历史
          </Button>
        ) : null}
      </Box>
    </Box>
  );
}

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
        {eras.map((era) => (
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
  if (event.conquerorFactionId && event.targetFactionId && event.cityName) {
    const conquerorName =
      teamByName.get(event.conquerorFactionId)?.displayName ?? event.conquerorFactionId;
    const targetName =
      teamByName.get(event.targetFactionId)?.displayName ?? event.targetFactionId;
    lines.push(
      `${conquerorName}攻陷${targetName}最后城市${event.cityName}。`
    );
  }
  if (event.metadata) {
    addMetadataLine(lines, event.metadata.populationBefore, "灭亡前人口");
    addMetadataLine(lines, event.metadata.surrenderedPopulation, "投降人口");
    addMetadataLine(lines, event.metadata.disbandedPopulation, "解散人口");
    addMetadataLine(lines, event.metadata.remnantPopulation, "残部人口");
    addMetadataLine(lines, event.metadata.population, "事件时人口");
    addMetadataLine(lines, event.metadata.populationCapacity, "事件时承载");
    addMetadataPercentLine(lines, event.metadata.territoryPercent, "事件时领土");
    addMetadataLine(lines, event.metadata.cityCount, "事件时城市");
    addMetadataLine(lines, event.metadata.stability, "事件时稳定");
    addMetadataLine(lines, event.metadata.duration, "持续年数");
    addMetadataLine(lines, event.metadata.effectDuration, "继承影响年数");
    addMetadataMultiplierLine(
      lines,
      event.metadata.populationGrowthMultiplier,
      "人口自然增长"
    );
    addMetadataMultiplierLine(
      lines,
      event.metadata.loyaltyRecoveryMultiplier,
      "忠诚恢复"
    );
    addMetadataMultiplierLine(
      lines,
      event.metadata.rebellionRiskMultiplier,
      "叛乱风险"
    );
    addMetadataLine(lines, event.metadata.cityLoyaltyDelta, "城市忠诚变化");
    addMetadataLine(lines, event.metadata.immediatePopulation, "立即人口变化");
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
