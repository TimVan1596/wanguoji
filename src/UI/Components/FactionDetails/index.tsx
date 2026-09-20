import { Box, Button, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getFactionStability } from "../../../Components/City";
import Game from "../../../Game/Game";
import { colorToString } from "../../../paid/theme";
import DynastyRegistry, { Ruler } from "../../../Politics/Dynasty";
import FactionSnapshots, {
  FactionSnapshot,
} from "../../../Simulation/FactionSnapshots";
import WorldHistory, { WorldEvent } from "../../../History/WorldHistory";
import { formatHistoryEventTitle } from "../../../History/HistoryRenderRules";
import { formatFactionHistoryEvent } from "../../../History/FactionHistoryFormatter";
import { groupHistoryNarratives } from "../../../History/HistoryNarrativeGrouper";
import {
  getMajorPoliticalEventsForFaction,
  selectMajorTimelineMarkers,
} from "../../../History/HistorySignificanceRules";
import { getPopulationCapacity } from "../../../Simulation/PopulationSystem";
import WorldRemnants from "../../../Simulation/WorldRemnants";
import WorldExiles from "../../../Simulation/WorldExiles";
import {
  formatWorldDate,
  formatWorldDuration,
  monthsToYears,
} from "../../../Simulation/WorldTime";
import {
  FactionListFilter,
  getVisibleFactions,
} from "../../../Simulation/FactionListRules";
import { createFactionArchiveLabelMap } from "../../../Simulation/FactionArchiveLabels";
import {
  calculateImperialStrain,
  getImperialStrainLevel,
} from "../../../Simulation/ImperialStrain";
import { getEffectiveStability } from "../../../Simulation/SovereigntyModifiers";
import { getRegimeStyleNameAtMonth } from "../../../Simulation/RegimeStyle";
import {
  calculateTerritoryMetrics,
  getFactionTerritoryMetric,
} from "../../../Simulation/TerritoryMetrics";
import {
  getFactionListDisplayName,
  getFactionRegimeBadge,
  getFactionRegimeWeight,
} from "../../../Simulation/FactionDisplayRules";
import {
  buildRulerAssessment,
  buildRulerTags,
  getRulerTerritoryDelta,
} from "../../../Politics/RulerChronicle";
import {
  formatPosthumousRulerName,
  getNotablePosthumousRulers,
  getPosthumousLabelLines,
} from "../../../Politics/PosthumousRules";
import {
  createPopulationTicks,
  createTimeTicks,
  normalizeMarkerEvents,
  TERRITORY_TICKS,
} from "../../../Simulation/TrendChartRules";
import { RootState } from "../../../store";
import {
  setFactionDetailTab,
  setSelectedFactionName,
} from "../../../store/rootSlice";
import formatNumber from "../../../utils/formatNumber";
import {
  buildEmperorQualificationLines,
  buildFactionOverviewSections,
  buildStateFormationStatusLines,
  getCumulativeActiveMonthsSafe,
} from "./model";
import { buildNotableRulerIndexEntry } from "./notableRulerIndex";

export default function FactionDetails() {
  const tab = useSelector((state: RootState) => state.root.factionDetailTab);
  const teams = useSelector((state: RootState) => state.root.teams);
  const worldMonth = useSelector((state: RootState) => state.root.worldMonth);
  const selectedFactionName = useSelector(
    (state: RootState) => state.root.selectedFactionName
  );
  const [factionListFilter, setFactionListFilter] =
    useState<FactionListFilter>("all");
  const [events, setEvents] = useState<WorldEvent[]>([]);
  const [rulerDetailId, setRulerDetailId] = useState<string | undefined>();
  useEffect(() => WorldHistory.subscribe(setEvents), []);
  const team = teams.find((item) => item.name === selectedFactionName);

  if (!team) {
    return (
      <FactionList
        teams={teams}
        worldMonth={worldMonth}
        filter={factionListFilter}
        onFilterChange={setFactionListFilter}
      />
    );
  }

  return (
    <FactionProfile
      team={team}
      teams={teams}
      worldMonth={worldMonth}
      tab={tab}
      events={events}
      rulerDetailId={rulerDetailId}
      onRulerDetailIdChange={setRulerDetailId}
    />
  );
}

function FactionProfile({
  team,
  teams,
  worldMonth,
  tab,
  events,
  rulerDetailId,
  onRulerDetailIdChange,
}: {
  team: RootState["root"]["teams"][number];
  teams: RootState["root"]["teams"];
  worldMonth: number;
  tab: string;
  events: WorldEvent[];
  rulerDetailId?: string;
  onRulerDetailIdChange: (id: string | undefined) => void;
}) {
  const dispatch = useDispatch();
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const totalCells = Game.Core?.totalCells ?? 1;
  const territoryMetrics = calculateTerritoryMetrics(teams, totalCells);
  const factionTerritory = getFactionTerritoryMetric(territoryMetrics, team.name);
  const activeTab = tab === "trend" || tab === "chronicle" ? "power" : tab;
  const rankedTeams = [...teams].sort(
    (a, b) => b.blocks.children.size - a.blocks.children.size
  );
  const activeCityCount = teams
    .filter((item) => item.status === "ACTIVE")
    .reduce((sum, item) => sum + item.cities.length, 0);
  const territory = team.blocks.children.size;
  const territoryPercent = factionTerritory.absoluteWorldShare;
  const controlledTerritoryPercent = factionTerritory.controlledTerritoryShare;
  const cityShare = activeCityCount > 0 ? (team.cities.length / activeCityCount) * 100 : 0;
  const imperialStrain = calculateImperialStrain(team, totalCells);
  const remnant = WorldRemnants.get(team.name);
  const exile = WorldExiles.get(team.name);
  const snapshots = FactionSnapshots.get(team.name);
  const dynasty = DynastyRegistry.get(team.name);
  const currentRuler = DynastyRegistry.getCurrentRuler(team.name);
  const stability = getFactionStability(team);
  const effectiveStability =
    stability !== undefined ? getEffectiveStability(stability, team.sovereigntyRank) : undefined;
  const hasFormalRuler = Boolean(
    currentRuler?.reignOrdinal !== undefined &&
      currentRuler.accessionYear !== undefined
  );
  const factionById = useMemo(
    () => new Map(teams.map((item) => [item.name, item])),
    [teams]
  );
  const archiveLabelById = useMemo(() => createFactionArchiveLabelMap(teams), [teams]);
  const groupedEvents = useMemo(() => groupHistoryNarratives(events), [events]);
  const majorEvents = useMemo(
    () => getMajorPoliticalEventsForFaction(groupedEvents, team.name),
    [groupedEvents, team.name]
  );
  const timelineMarkers = useMemo(
    () => selectMajorTimelineMarkers(groupedEvents, team.name, 10),
    [groupedEvents, team.name]
  );
  const notableRulers = useMemo(
    () => getNotablePosthumousRulers(dynasty?.rulers ?? [], team, 3),
    [dynasty?.rulers, team]
  );
  const cityNameById = useMemo(
    () =>
      new Map(
        teams.flatMap((item) => item.cities.map((city) => [city.id, city.name] as const))
      ),
    [teams]
  );
  const rulerNameById = useMemo(
    () =>
      new Map(
        (dynasty?.rulers ?? []).map((ruler) => [ruler.id, formatRulerName(ruler)] as const)
      ),
    [dynasty?.rulers]
  );
  const foundingKing = useMemo(
    () => (dynasty?.rulers ?? []).find((ruler) => ruler.chronicle?.foundedStateName),
    [dynasty?.rulers]
  );
  const foundingEmperor = useMemo(
    () =>
      (dynasty?.rulers ?? []).find(
        (ruler) => ruler.chronicle?.proclaimedEmperorMonth !== undefined
      ),
    [dynasty?.rulers]
  );
  const overviewSections = buildFactionOverviewSections({
    team,
    teams,
    cityNameById,
    rulerNameById,
    worldMonth,
    remnantPopulation: remnant?.population ?? 0,
    exileLegitimacy: exile?.legitimacy,
    foundingKingName: foundingKing ? formatRulerName(foundingKing) : undefined,
    foundingEmperorName: foundingEmperor ? formatRulerName(foundingEmperor) : undefined,
  });
  const emperorQualificationLines = buildEmperorQualificationLines({
    team,
    worldMonth,
    territoryShare: controlledTerritoryPercent,
    cityShare,
    leadShare:
      controlledTerritoryPercent -
      Math.max(
        0,
        ...teams
          .filter((item) => item.status === "ACTIVE" && item.name !== team.name)
          .map(
            (item) =>
              getFactionTerritoryMetric(territoryMetrics, item.name)
                .controlledTerritoryShare
          )
      ),
    effectiveStability,
    hasFormalRuler,
  });
  const rankIndex = rankedTeams.findIndex((item) => item === team) + 1;
  const headerName =
    team.identityStage === "STATE"
      ? getRegimeStyleNameAtMonth(team, worldMonth)
      : archiveLabelById.get(team.name) ?? team.displayName;
  const regimeLevel =
    team.identityStage === "STATE"
      ? team.sovereigntyRank === "EMPEROR"
        ? "帝国"
        : "王国"
      : team.factionType === "SPLIT"
      ? "分裂政权"
      : team.factionType === "FRONTIER"
      ? "边境军"
      : "义军政权";

  return (
    <Box sx={{ p: 1.25, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
      <Button
        size="small"
        onClick={() => dispatch(setSelectedFactionName(undefined))}
        sx={{ mb: 0.75 }}
      >
        ← 返回势力列表
      </Button>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
        <Box
          sx={{
            width: "0.9rem",
            height: "0.9rem",
            backgroundColor: colorToString(team.color),
            border: "1px solid rgba(0,0,0,0.35)",
          }}
        />
        <Typography fontWeight="bold" variant="h6">
          {headerName}
        </Typography>
      </Box>
      <Typography fontSize="0.84rem" color="var(--gg-text-muted)" sx={{ mt: 0.25 }}>
        {regimeLevel} · {formatStatus(team.status)} · 天下第{rankIndex}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.5, my: 1 }}>
        {[
          ["overview", "概况"],
          ["power", "国势"],
          ["house", "王室"],
        ].map(([value, label]) => (
          <Button
            key={value}
            size="small"
            variant={activeTab === value ? "contained" : "outlined"}
            onClick={() => dispatch(setFactionDetailTab(value))}
          >
            {label}
          </Button>
        ))}
      </Box>
      {activeTab === "overview" ? (
        <>
          <OverviewSection title="身份沿革" lines={overviewSections.identityLines} />
          {buildStateFormationStatusLines(team, worldMonth, effectiveStability, hasFormalRuler).map((line) => (
            <Typography key={line} fontSize="0.9rem" color="var(--gg-text-muted)">
              {line}
            </Typography>
          ))}
          <OverviewSection
            title="当前国势"
            lines={[
              `当前国君：${currentRuler ? formatRulerName(currentRuler) : "无"}`,
              `在位：${
                currentRuler?.accessionYear !== undefined
                  ? formatWorldDuration(worldMonth - currentRuler.accessionYear)
                  : "—"
              }`,
              `年龄：${
                currentRuler
                  ? `${Math.floor(monthsToYears(worldMonth - currentRuler.bornYear))} 岁`
                  : "—"
              }`,
              `王室：${dynasty?.houseName ?? team.houseName ?? "无"}`,
              `人口：${formatNumber(team.users.size)} / ${formatNumber(getPopulationCapacity(team))}`,
              `领土：${formatNumber(territory)} 格 · 世界${territoryPercent.toFixed(1)}% · 诸国${controlledTerritoryPercent.toFixed(1)}%`,
              `城市：${team.cities.length}`,
              `首都：${team.capitalCity?.name ?? "无"}`,
              `稳定度：${
                stability === undefined
                  ? "—"
                  : effectiveStability !== stability
                  ? `${effectiveStability}（基础${stability}）`
                  : stability
              }`,
              `统治压力：${getImperialStrainLevel(imperialStrain)}`,
              `残部：${remnant ? `${remnant.population} 人` : "无"}`,
            ]}
          />
          {emperorQualificationLines.length > 0 ? (
            <OverviewSection title="帝号资格" lines={emperorQualificationLines} muted />
          ) : null}
          <OverviewSection title="王朝记忆" lines={overviewSections.legacyLines} />
          {notableRulers.length > 0 ? (
            <Box sx={{ mt: 1 }}>
              <Typography fontWeight="bold" fontSize="0.9rem">
                历代名君
              </Typography>
              {notableRulers.map((item) => {
                const entry = buildNotableRulerIndexEntry({
                  start: item.start,
                  end: item.end,
                  displayName: item.displayName,
                  tags: getRulerImportantLabels(item.ruler),
                });
                return (
                  <Button
                    key={item.ruler.id}
                    size="small"
                    onClick={() => {
                      onRulerDetailIdChange(item.ruler.id);
                      dispatch(setFactionDetailTab("house"));
                    }}
                    sx={{
                      display: "block",
                      justifyContent: "flex-start",
                      px: 0,
                      py: 0.15,
                      minWidth: 0,
                      textAlign: "left",
                    }}
                  >
                    <Typography component="span" fontSize="0.72rem" color="var(--gg-text-muted)" sx={{ display: "block" }}>
                      {entry.dateRange}
                    </Typography>
                    <Typography component="span" fontSize="0.86rem" sx={{ display: "block", fontWeight: item.ruler.templeName ? 700 : 500 }}>
                      {entry.displayName}
                    </Typography>
                    {entry.tagLine ? (
                      <Typography component="span" fontSize="0.72rem" color="var(--gg-text-muted)" sx={{ display: "block" }}>
                        {entry.tagLine}
                      </Typography>
                    ) : null}
                  </Button>
                );
              })}
              <Button
                size="small"
                onClick={() => dispatch(setFactionDetailTab("house"))}
                sx={{ px: 0, minWidth: 0 }}
              >
                查看更多 →
              </Button>
            </Box>
          ) : null}
        </>
      ) : null}
      {activeTab === "power" ? (
        <Box sx={{ display: "grid", gap: 1 }}>
          <TrendChart
            title="人口变化"
            color={team.color}
            snapshots={snapshots}
            getValue={(snapshot) => snapshot.population}
            valueLabel={(value) => `${Math.round(value)}人`}
            events={timelineMarkers}
            factionById={factionById}
            scale="population"
            selectedEventId={selectedEventId}
            onEventSelect={setSelectedEventId}
          />
          <TrendChart
            title="领土占比"
            color={team.color}
            snapshots={snapshots}
            getValue={(snapshot) => snapshot.territoryShare * 100}
            valueLabel={(value) => `${value.toFixed(1)}%`}
            events={timelineMarkers}
            factionById={factionById}
            scale="territory"
            selectedEventId={selectedEventId}
            onEventSelect={setSelectedEventId}
          />
          <Typography fontSize="0.8rem" color="var(--gg-text-muted)">
            每12个世界月采样一次。当前纪元 {formatWorldDate(worldMonth)}。
          </Typography>
          <Typography fontWeight="bold" fontSize="0.9rem">
            国势大事记
          </Typography>
          <FactionChronicle
            events={majorEvents}
            factionById={factionById}
            factionId={team.name}
            selectedEventId={selectedEventId}
            onEventSelect={setSelectedEventId}
          />
        </Box>
      ) : null}
      {activeTab === "house" ? (
        <DynastyTree
          rulers={dynasty?.rulers ?? []}
          currentRulerId={dynasty?.currentRulerId}
          worldMonth={worldMonth}
          factionStatus={team.status}
          team={team}
          selectedRulerId={rulerDetailId}
          onSelectedRulerIdChange={onRulerDetailIdChange}
        />
      ) : null}
    </Box>
  );
}

function OverviewSection({
  title,
  lines,
  muted = false,
}: {
  title: string;
  lines: string[];
  muted?: boolean;
}) {
  if (lines.length === 0) {
    return null;
  }
  return (
    <Box sx={{ mt: 1 }}>
      <Typography fontWeight="bold" fontSize="0.9rem">
        {title}
      </Typography>
      {lines.map((line) => (
        <Typography
          key={line}
          fontSize="0.86rem"
          color={muted ? "var(--gg-text-muted)" : undefined}
        >
          {line}
        </Typography>
      ))}
    </Box>
  );
}

function FactionList({
  teams,
  worldMonth,
  filter,
  onFilterChange,
}: {
  teams: RootState["root"]["teams"];
  worldMonth: number;
  filter: FactionListFilter;
  onFilterChange: (filter: FactionListFilter) => void;
}) {
  const visibleTeams = getVisibleFactions(
    [...teams].sort((a, b) => {
      if (a.status !== b.status) {
        const order = { ACTIVE: 0, EXILED: 1, EXTINCT: 2 };
        return order[a.status] - order[b.status];
      }
      return getCumulativeActiveMonthsSafe(b, worldMonth) - getCumulativeActiveMonthsSafe(a, worldMonth);
    }),
    filter
  );
  const archiveLabelById = useMemo(() => createFactionArchiveLabelMap(teams), [teams]);
  return (
    <Box sx={{ p: 1.25, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
      <Typography fontWeight="bold" variant="h6">
        天下势力
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.4, my: 0.75 }}>
        {[
          ["all", "全部"],
          ["active", "存续"],
          ["exiled", "流亡"],
          ["extinct", "灭亡"],
        ].map(([value, label]) => (
          <Button
            key={value}
            size="small"
            variant={filter === value ? "contained" : "outlined"}
            onClick={() => onFilterChange(value as FactionListFilter)}
            sx={{ minWidth: 0, px: 0.5, fontSize: "0.72rem" }}
          >
            {label}
          </Button>
        ))}
      </Box>
      <Box sx={{ display: "grid", gap: 0.45 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1.1fr 0.65fr 0.9fr 1fr 0.55fr 0.65fr",
            gap: 0.45,
            fontSize: "0.72rem",
            color: "var(--gg-text-muted)",
          }}
        >
          <span>名称</span>
          <span>状态</span>
          <span>初建</span>
          <span>国祚</span>
          <span>城</span>
          <span>复国</span>
        </Box>
        {visibleTeams.map((team) => (
          <Box
            key={team.name}
            onClick={() => Game.Core?.selectFaction(team.name)}
            sx={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.65fr 0.9fr 1fr 0.55fr 0.65fr",
              gap: 0.45,
              alignItems: "center",
              fontSize: "0.76rem",
              p: 0.55,
              border: "1px solid var(--gg-border)",
              borderRadius: "var(--gg-radius)",
              cursor: "pointer",
              background: "var(--gg-panel)",
              "&:hover": {
                borderColor: "var(--gg-selected)",
              },
            }}
          >
            <span>
              <Box
                component="span"
                sx={{
                  display: "inline-block",
                  width: "0.65rem",
                  height: "0.65rem",
                  mr: 0.45,
                  backgroundColor: colorToString(team.color),
                  border: "1px solid rgba(0,0,0,0.35)",
                  verticalAlign: "-0.05rem",
                }}
              />
              <Box component="span" sx={{ fontWeight: getFactionRegimeWeight(team) === 2 ? 800 : 600 }}>
                {archiveLabelById.get(team.name) ?? getFactionListDisplayName(team, worldMonth)}
              </Box>
              <Box
                component="span"
                sx={{
                  display: "block",
                  mt: 0.1,
                  ml: 1.1,
                  fontSize: "0.66rem",
                  color:
                    getFactionRegimeWeight(team) === 2
                      ? "#7a4b00"
                      : "var(--gg-text-muted)",
                }}
              >
                {getFactionRegimeBadge(team)}
              </Box>
            </span>
            <span>{formatStatus(team.status)}</span>
            <span>{formatWorldDate(team.firstFoundedYear)}</span>
            <span>{formatWorldDuration(getCumulativeActiveMonthsSafe(team, worldMonth))}</span>
            <span>{team.cities.length}</span>
            <span>{team.restorationYears.length || "—"}</span>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function DynastyTree({
  rulers,
  currentRulerId,
  worldMonth,
  factionStatus,
  team,
  selectedRulerId,
  onSelectedRulerIdChange,
}: {
  rulers: Ruler[];
  currentRulerId?: string | null;
  worldMonth: number;
  factionStatus: RootState["root"]["teams"][number]["status"];
  team: RootState["root"]["teams"][number];
  selectedRulerId?: string;
  onSelectedRulerIdChange: (id: string | undefined) => void;
}) {
  if (rulers.length === 0) {
    return (
      <Typography fontSize="0.9rem" color="var(--gg-text-muted)">
        暂无王室记录。
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {rulers.map((ruler, index) => {
          const current = ruler.id === currentRulerId;
          const expanded = ruler.id === selectedRulerId;
          return (
            <Box
              key={ruler.id}
              sx={{
                position: "relative",
                pl: 1.5,
                py: 0.5,
                borderLeft: index === 0 ? "none" : "1px solid var(--gg-border)",
                border: expanded ? "1px solid var(--gg-selected)" : "1px solid transparent",
                borderRadius: "var(--gg-radius)",
              }}
            >
              <Box
                onClick={() => onSelectedRulerIdChange(expanded ? undefined : ruler.id)}
                sx={{ cursor: "pointer" }}
              >
                <Typography
                  fontWeight={ruler.templeName ? "bold" : current || ruler.posthumousEpithet ? 600 : "normal"}
                  fontSize="0.92rem"
                >
                  {current ? "● " : ""}
                  {formatRulerRowName(ruler, team)}
                </Typography>
                <Typography fontSize="0.82rem" color="var(--gg-text-muted)">
                  {formatRulerListSubtitle(ruler, worldMonth, factionStatus)}
                </Typography>
                {isFormalRuler(ruler) ? (
                  <Box sx={{ display: "flex", gap: 0.35, flexWrap: "wrap", mt: 0.25 }}>
                    {getRulerImportantLabels(ruler).slice(0, 2).map((label) => (
                      <Box
                        key={label}
                        component="span"
                        sx={{
                          fontSize: "0.68rem",
                          px: 0.45,
                          py: 0.1,
                          border: "1px solid var(--gg-border)",
                          borderRadius: "999px",
                          background:
                            team.sovereigntyRank === "EMPEROR"
                              ? "rgba(255,255,255,0.65)"
                              : "rgba(255,255,255,0.4)",
                        }}
                      >
                        【{label}】
                      </Box>
                    ))}
                  </Box>
                ) : null}
              </Box>
              {expanded ? (
                <Box sx={{ mt: 0.65 }}>
                  {isFormalRuler(ruler) ? (
                    <RulerBiography ruler={ruler} worldMonth={worldMonth} team={team} />
                  ) : (
                    <HeirArchive
                      ruler={ruler}
                      worldMonth={worldMonth}
                      factionStatus={factionStatus}
                    />
                  )}
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function RulerBiography({
  ruler,
  worldMonth,
  team,
}: {
  ruler: FormalRuler;
  worldMonth: number;
  team: RootState["root"]["teams"][number];
}) {
  const reignEnd = ruler.endYear ?? worldMonth;
  const reignMonths = Math.max(0, reignEnd - ruler.accessionYear);
  const accessionAge = Math.floor(monthsToYears(ruler.accessionYear - ruler.bornYear));
  const finalAge = Math.floor(monthsToYears(reignEnd - ruler.bornYear));
  const tags = buildRulerTags(ruler.chronicle, reignMonths);
  const assessment = buildRulerAssessment(
    formatRulerName(ruler),
    ruler.chronicle,
    reignMonths
  );
  const start = ruler.chronicle.accessionSnapshot;
  const end = ruler.chronicle.endSnapshot ?? start;
  const territoryDelta = getRulerTerritoryDelta(ruler.chronicle);
  const posthumousLines = getPosthumousLabelLines(ruler, team, ruler.endYear ?? worldMonth);
  return (
    <Box
      sx={{
        border: "1px solid var(--gg-border)",
        borderRadius: "var(--gg-radius)",
        p: 1,
        background: "var(--gg-panel)",
      }}
    >
      <Typography fontWeight="bold">{formatRulerName(ruler)}</Typography>
      {ruler.endYear !== undefined && (ruler.templeName || ruler.posthumousEpithet) ? (
        <Typography fontSize="0.86rem">
          {formatPosthumousRulerName(ruler, team, ruler.endYear)}
        </Typography>
      ) : null}
      <Typography fontSize="0.85rem" color="var(--gg-text-muted)">
        {ruler.houseName} ·{" "}
        {ruler.reignOrdinal ? `第${ruler.reignOrdinal}代君主 · ` : ""}
        {formatWorldDate(ruler.accessionYear)}～
        {ruler.endYear !== undefined ? formatWorldDate(ruler.endYear) : "今"}
      </Typography>
      <Typography fontSize="0.85rem">
        在位：{formatWorldDuration(reignMonths)}
      </Typography>
      <Typography fontSize="0.85rem">
        即位年龄：{accessionAge} 岁 · {ruler.endYear !== undefined ? "享年" : "当前年龄"}：
        {finalAge} 岁
        {ruler.endReason ? ` · ${ruler.endReason}` : ""}
      </Typography>
      {posthumousLines.length > 0 ? (
        <Box sx={{ mt: 0.5 }}>
          {posthumousLines.map((line) => (
            <Typography key={line} fontSize="0.82rem">
              {line}
            </Typography>
          ))}
        </Box>
      ) : null}
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", my: 0.75 }}>
        {(tags.length > 0 ? tags : ["未定"]).map((tag) => (
          <Box
            key={tag}
            component="span"
            sx={{
              fontSize: "0.75rem",
              px: 0.65,
              py: 0.2,
              border: "1px solid var(--gg-border)",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.5)",
            }}
          >
            【{tag}】
          </Box>
        ))}
      </Box>
      <Typography fontWeight="bold" fontSize="0.86rem">
        国势变化
      </Typography>
      <Typography fontSize="0.82rem">
        人口：{start.population} → {end.population}
      </Typography>
      <Typography fontSize="0.82rem">
        领土：{(start.territoryShare * 100).toFixed(1)}% →{" "}
        {(end.territoryShare * 100).toFixed(1)}% (
        {territoryDelta >= 0 ? "+" : ""}
        {(territoryDelta * 100).toFixed(1)}%)
      </Typography>
      <Typography fontSize="0.82rem">
        城市：{start.cityCount} → {end.cityCount}
      </Typography>
      <Typography fontSize="0.82rem">
        稳定：{start.stability} → {end.stability}
      </Typography>
      <Typography fontWeight="bold" fontSize="0.86rem" sx={{ mt: 0.75 }}>
        大事记
      </Typography>
      <Typography fontSize="0.82rem">
        亲征夺城：{ruler.chronicle.citiesCapturedPersonally} · 失城：
        {ruler.chronicle.citiesLostDuringReign} · 内乱：
        {ruler.chronicle.rebellionsDuringReign} · 复国：
        {ruler.chronicle.restorationsDuringReign}
      </Typography>
      <Typography fontWeight="bold" fontSize="0.86rem" sx={{ mt: 0.75 }}>
        史评
      </Typography>
      {assessment.map((line) => (
        <Typography key={line} fontSize="0.82rem">
          {line}
        </Typography>
      ))}
    </Box>
  );
}

type FormalRuler = Ruler & {
  accessionYear: number;
  chronicle: NonNullable<Ruler["chronicle"]>;
  reignOrdinal: number;
};

function isFormalRuler(ruler: Ruler): ruler is FormalRuler {
  return (
    ruler.reignOrdinal !== undefined &&
    ruler.accessionYear !== undefined &&
    ruler.chronicle !== undefined
  );
}

function HeirArchive({
  ruler,
  worldMonth,
  factionStatus,
}: {
  ruler: Ruler;
  worldMonth: number;
  factionStatus: RootState["root"]["teams"][number]["status"];
}) {
  const start = ruler.politicalStartYear;
  const end = ruler.politicalEndYear;
  const ageEnd = end ?? worldMonth;
  return (
    <Box
      sx={{
        border: "1px solid var(--gg-border)",
        borderRadius: "var(--gg-radius)",
        p: 1,
        background: "var(--gg-panel)",
      }}
    >
      <Typography fontWeight="bold">{formatRulerName(ruler)}</Typography>
      <Typography fontSize="0.85rem" color="var(--gg-text-muted)">
        {ruler.houseName} ·{" "}
        {start !== undefined ? formatWorldDate(start) : "—"}～
        {end !== undefined ? formatWorldDate(end) : "今"} ·{" "}
        {ruler.endReason ?? formatRulerStatus(ruler.status, factionStatus)}
      </Typography>
      <Typography fontSize="0.85rem">
        年龄：{Math.floor(monthsToYears(ageEnd - ruler.bornYear))} 岁
      </Typography>
      <Typography fontSize="0.82rem" color="var(--gg-text-muted)" sx={{ mt: 0.75 }}>
        未正式即位，未形成君主在位纪年、国势变化或史评。
      </Typography>
    </Box>
  );
}

function formatRulerStatus(
  status: Ruler["status"],
  factionStatus?: RootState["root"]["teams"][number]["status"]
) {
  if (status === "exiled") {
    return "流亡家主";
  }
  if (status === "heir") {
    return factionStatus === "EXILED" ? "流亡王室继承人" : "继承人";
  }
  if (status === "dead") {
    return "已故";
  }
  return "君主";
}

function formatRulerRowName(
  ruler: Ruler,
  team: RootState["root"]["teams"][number]
) {
  if (ruler.endYear !== undefined && (ruler.templeName || ruler.posthumousEpithet)) {
    return formatPosthumousRulerName(ruler, team, ruler.endYear);
  }
  return formatRulerName(ruler);
}

function formatRulerListSubtitle(
  ruler: Ruler,
  worldMonth: number,
  factionStatus?: RootState["root"]["teams"][number]["status"]
) {
  if (isFormalRuler(ruler)) {
    const reignEnd = ruler.endYear ?? worldMonth;
    const reignMonths = Math.max(0, reignEnd - ruler.accessionYear);
    return `第${ruler.reignOrdinal}代 · 在位${formatWorldDuration(reignMonths)} · ${
      ruler.endReason ?? (ruler.endYear === undefined ? "在位" : formatRulerStatus(ruler.status, factionStatus))
    }`;
  }
  return `${ruler.politicalStartYear !== undefined ? formatWorldDate(ruler.politicalStartYear) : "—"}～${
    ruler.politicalEndYear !== undefined ? formatWorldDate(ruler.politicalEndYear) : "今"
  } · ${ruler.endReason ?? formatRulerStatus(ruler.status, factionStatus)}`;
}

function getRulerImportantLabels(ruler: Ruler) {
  const chronicle = ruler.chronicle;
  if (!chronicle) {
    return [];
  }
  const labels: string[] = [];
  if (chronicle.foundedStateName) {
    labels.push("开国");
  }
  if (chronicle.proclaimedEmperorMonth !== undefined) {
    labels.push("称帝");
  }
  if (chronicle.restorationsDuringReign > 0) {
    labels.push("复国");
  }
  if (chronicle.completedUnification) {
    labels.push("一统");
  }
  return labels;
}

function FactionChronicle({
  events,
  factionById,
  factionId,
  selectedEventId,
  onEventSelect,
}: {
  events: WorldEvent[];
  factionById: Map<string, RootState["root"]["teams"][number]>;
  factionId: string;
  selectedEventId?: string;
  onEventSelect?: (id: string) => void;
}) {
  if (events.length === 0) {
    return (
      <Typography fontSize="0.9rem" color="var(--gg-text-muted)">
        暂无重大政权大事。
      </Typography>
    );
  }
  return (
    <Box sx={{ display: "grid", gap: 0.55 }}>
      {[...events].reverse().map((event) => (
        <Box
          key={event.id}
          onClick={() => onEventSelect?.(event.id)}
          sx={{
            borderLeft:
              selectedEventId === event.id
                ? "3px solid var(--gg-selected)"
                : "2px solid var(--gg-selected)",
            pl: 0.75,
            py: 0.25,
            cursor: onEventSelect ? "pointer" : "default",
            background:
              selectedEventId === event.id ? "rgba(255,255,255,0.45)" : "transparent",
          }}
        >
          <Typography fontSize="0.76rem" color="var(--gg-text-muted)">
            {formatWorldDate(event.monthIndex ?? event.year)}
          </Typography>
          <Typography fontSize="0.84rem">
            {formatFactionHistoryEvent(event, factionId, factionById) ??
              formatHistoryEventTitle(event, factionById)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function formatRulerName(ruler: Ruler) {
  return `${ruler.houseName.replace(/氏$/, "")}${ruler.givenName}`;
}

function formatStatus(status: string) {
  if (status === "ACTIVE") {
    return "存续";
  }
  if (status === "EXILED") {
    return "流亡";
  }
  return "灭绝";
}

function TrendChart({
  title,
  color,
  snapshots,
  getValue,
  valueLabel,
  events,
  factionById,
  scale,
  selectedEventId,
  onEventSelect,
}: {
  title: string;
  color: number;
  snapshots: FactionSnapshot[];
  getValue: (snapshot: FactionSnapshot) => number;
  valueLabel: (value: number) => string;
  events: WorldEvent[];
  factionById: Map<string, RootState["root"]["teams"][number]>;
  scale: "population" | "territory";
  selectedEventId?: string;
  onEventSelect?: (id: string) => void;
}) {
  const [hover, setHover] = useState<string | undefined>();
  const values = snapshots.map(getValue);
  const lastValue = values[values.length - 1] ?? 0;
  const timeTicks = createTimeTicks(snapshots);
  const yTicks = scale === "territory" ? TERRITORY_TICKS : createPopulationTicks(values);
  const markers = normalizeMarkerEvents(events, snapshots);
  const points = buildChartPoints(snapshots, values, yTicks);
  const path = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  return (
    <Box
      sx={{
        border: "1px solid var(--gg-border)",
        borderRadius: "var(--gg-radius)",
        p: 1,
        backgroundColor: "var(--gg-panel)",
      }}
    >
      <Typography fontWeight="bold" fontSize="0.9rem">
        {title} · {valueLabel(lastValue)}
      </Typography>
      <svg width="100%" height="128" viewBox="0 0 260 120" role="img">
        {yTicks.map((tick) => {
          const y = yToChart(tick, yTicks);
          return (
            <g key={`y-${tick}`}>
              <line x1="32" x2="246" y1={y} y2={y} stroke="rgba(0,0,0,0.08)" />
              <text x="28" y={y + 3} textAnchor="end" fontSize="8" fill="var(--gg-text-muted)">
                {scale === "territory" ? `${tick}%` : tick}
              </text>
            </g>
          );
        })}
        {timeTicks.map((tick) => {
          const x = monthToChartX(tick, snapshots);
          return (
            <g key={`x-${tick}`}>
              <line x1={x} x2={x} y1="14" y2="94" stroke="rgba(0,0,0,0.05)" />
              <text x={x} y="112" textAnchor="middle" fontSize="8" fill="var(--gg-text-muted)">
                {formatWorldDate(tick).replace(/月$/, "")}
              </text>
            </g>
          );
        })}
        <polyline
          points={path}
          fill="none"
          stroke={colorToString(color)}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {markers.map((event, index) => {
          const x = monthToChartX(event.monthIndex ?? event.year, snapshots);
          const markerTitle = formatHistoryEventTitle(event, factionById);
          const selected = selectedEventId === event.id;
          return (
            <g
              key={event.id}
              onMouseEnter={() => setHover(`${formatWorldDate(event.monthIndex ?? event.year)} ${markerTitle}`)}
              onMouseLeave={() => setHover(undefined)}
              onClick={() => onEventSelect?.(event.id)}
              style={{ cursor: onEventSelect ? "pointer" : "default" }}
            >
              <text
                x={x}
                y={index % 2 === 0 ? 12 : 22}
                textAnchor="middle"
                fontSize={selected ? "13" : "10"}
                fontWeight={selected ? "700" : "400"}
                fill={colorToString(color)}
              >
                ◆
              </text>
            </g>
          );
        })}
        {points.map((point) => (
          <circle
            key={`${point.month}-${point.value}`}
            cx={point.x}
            cy={point.y}
            r="3"
            fill={colorToString(color)}
            onMouseEnter={() =>
              setHover(`${formatWorldDate(point.month)} ${title}：${valueLabel(point.value)}`)
            }
            onMouseLeave={() => setHover(undefined)}
          />
        ))}
      </svg>
      <Typography fontSize="0.75rem" color="var(--gg-text-muted)" sx={{ minHeight: "1.1rem" }}>
        {hover ?? "悬停查看节点"}
      </Typography>
    </Box>
  );
}

function buildChartPoints(
  snapshots: FactionSnapshot[],
  values: number[],
  yTicks: number[]
) {
  if (snapshots.length === 0) {
    return [{ x: 32, y: 94, month: 0, value: 0 }];
  }
  return snapshots.map((snapshot, index) => ({
    x: monthToChartX(snapshot.year, snapshots),
    y: yToChart(values[index] ?? 0, yTicks),
    month: snapshot.year,
    value: values[index] ?? 0,
  }));
}

function monthToChartX(month: number, snapshots: FactionSnapshot[]) {
  if (snapshots.length <= 1) {
    return 32;
  }
  const first = snapshots[0].year;
  const last = snapshots[snapshots.length - 1].year;
  return 32 + ((month - first) / Math.max(1, last - first)) * 214;
}

function yToChart(value: number, ticks: number[]) {
  const min = ticks[0] ?? 0;
  const max = ticks[ticks.length - 1] ?? 1;
  return 94 - ((value - min) / Math.max(1, max - min)) * 80;
}
