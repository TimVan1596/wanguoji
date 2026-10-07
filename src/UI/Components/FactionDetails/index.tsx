import { getHouseEpochPresentation, getSignificantReignStats } from "./RoyalPresentation";
import { getFactionColorAtMonth, type FactionColorHistoryEntry } from "../../../Simulation/FactionColorHistory";
import { Box, Button, Dialog, DialogContent, DialogTitle, Typography } from "@mui/material";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getFactionStability } from "../../../Components/City";
import Game from "../../../Game/Game";
import { colorToString } from "../../../paid/theme";
import DynastyRegistry, { Dynasty, Ruler } from "../../../Politics/Dynasty";
import Diplomacy from "../../../Politics/Diplomacy";
import { formatDiplomacyRelationLines, getFactionDiplomacyBadges } from "../../../Politics/DiplomacyPresentation";
import FactionSnapshots, {
  FactionSnapshot,
} from "../../../Simulation/FactionSnapshots";
import WorldHistory, { WorldEvent } from "../../../History/WorldHistory";
import { formatHistoryEventTitle } from "../../../History/HistoryRenderRules";
import { formatRulerDiplomacyEvent } from "../../../History/RulerDiplomacyFormatter";
import { formatFactionHistoryEvent } from "../../../History/FactionHistoryFormatter";
import { groupHistoryNarratives } from "../../../History/HistoryNarrativeGrouper";
import {
  getFactionPowerChronicleEvents,
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
  buildRulerTags,
  getRulerHistoricalEvents,
  getRulerTerritoryDelta,
} from "../../../Politics/RulerChronicle";
import { composeHistorianVoice, deriveRulerAssessment } from "../../../Politics/RulerHistoriography";
import { deriveRulerTenureEvidence } from "../../../Politics/RulerTenureEvidence";
import { getFormalRulers, isFormalRulerRecord } from "../../../Politics/RulerPresentationRules";
import {
  buildPoliticalGenealogy,
  formatRecordedKinship,
  formatRecordedSuccessionKinship,
  getSuccessionBackground,
} from "../../../Politics/DynasticCandidateRules";
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
  getEventMarkerLaneY,
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
import {
  clampGenealogyScale,
  buildGenealogyOnDemand,
  GENEALOGY_SCALE_STEP,
  getGenealogyCanvasLayout,
  getGenealogyFitScale,
} from "./genealogyViewport";
import {
  recordGenealogyViewerClose,
  recordGenealogyViewerOpen,
  type GenealogyViewerCloseSource,
} from "./GenealogyViewerDiagnostics";
import {
  formatRulerLineage,
  formatRulerRelation,
} from "./RulerRelationPresentation";

export default function FactionDetails() {
  const tab = useSelector((state: RootState) => state.root.factionDetailTab);
  const teams = useSelector((state: RootState) => state.root.teams);
  const worldMonth = useSelector((state: RootState) => state.root.worldMonth);
  const selectedFactionName = useSelector(
    (state: RootState) => state.root.selectedFactionName
  );
  const [factionListFilter, setFactionListFilter] =
    useState<FactionListFilter>("all");
  const [historyRevision, setHistoryRevision] = useState(() => WorldHistory.getRevision());
  const [rulerDetailId, setRulerDetailId] = useState<string | undefined>();
  useEffect(() => WorldHistory.subscribeRevision(setHistoryRevision), []);
  const team = teams.find((item) => item.name === selectedFactionName);
  // Complete archive is intentional here: biographies and faction narratives may need
  // another faction's member of the same historical chain. No eager publisher snapshot.
  const events = useMemo(() => selectedFactionName ? WorldHistory.getEvents() : [],
    [historyRevision, selectedFactionName]);

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
  const [genealogyViewerOpen, setGenealogyViewerOpen] = useState(false);
  const genealogyViewerOpenRef = useRef(false);
  const previousFactionIdRef = useRef(team.name);
  const openFullGenealogy = () => {
    genealogyViewerOpenRef.current = true;
    setGenealogyViewerOpen(true);
    recordGenealogyViewerOpen();
  };
  const closeFullGenealogy = (source: GenealogyViewerCloseSource, muiReason?: string) => {
    genealogyViewerOpenRef.current = false;
    setGenealogyViewerOpen(false);
    recordGenealogyViewerClose(source, muiReason);
  };
  useEffect(() => {
    if (previousFactionIdRef.current !== team.name && genealogyViewerOpenRef.current) {
      closeFullGenealogy("FACTION_CHANGED");
    }
    previousFactionIdRef.current = team.name;
  }, [team.name]);
  useEffect(() => () => {
    if (genealogyViewerOpenRef.current) {
      genealogyViewerOpenRef.current = false;
      recordGenealogyViewerClose("HOST_UNMOUNT");
    }
  }, []);
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
  const currentRulerTenure = currentRuler?.accessionYear !== undefined
    ? deriveRulerTenureEvidence(currentRuler, team.name, events, worldMonth)
    : undefined;
  const stability = getFactionStability(team);
  const diplomacyLines = Diplomacy.list(worldMonth)
    .filter((relation) => relation.factionAId === team.name || relation.factionBId === team.name)
    .flatMap((relation) => {
      const otherId = relation.factionAId === team.name ? relation.factionBId : relation.factionAId;
      const other = teams.find((candidate) => candidate.name === otherId);
      return formatDiplomacyRelationLines(relation, other?.displayName ?? otherId);
    });
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
    () => getFactionPowerChronicleEvents(groupedEvents, team.name, (id, month) => { const t = factionById.get(id); return t?.stateFoundedMonth !== undefined && t.stateFoundedMonth <= month; }),
    [groupedEvents, team.name, factionById]
  );
  const timelineMarkers = useMemo(
    () => selectMajorTimelineMarkers(groupedEvents, team.name, 10, (id, month) => { const t = factionById.get(id); return t?.stateFoundedMonth !== undefined && t.stateFoundedMonth <= month; }),
    [groupedEvents, team.name, factionById]
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
        {regimeLevel} · {formatStatus(team.status, team.terminationReason)} · 天下第{rankIndex}
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
              currentRulerTenure && (currentRulerTenure.exileMonths > 0 || currentRulerTenure.exiledAtAccession || currentRulerTenure.lostStateDuringTenure)
                ? `承统：${formatWorldDuration(currentRulerTenure.totalTenureMonths)} · 在国：${formatWorldDuration(currentRulerTenure.activeRuleMonths)} · 流亡：${formatWorldDuration(currentRulerTenure.exileMonths)}`
                : `在位：${currentRuler?.accessionYear !== undefined ? formatWorldDuration(currentRulerTenure?.totalTenureMonths ?? 0) : "—"}`,
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
          {diplomacyLines.length > 0 ? <OverviewSection title="外交关系" lines={diplomacyLines} /> : null}
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
            colorHistory={team.colorHistory}
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
            colorHistory={team.colorHistory}
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
          key={team.name}
          dynasty={dynasty}
          rulers={dynasty?.rulers ?? []}
          currentRulerId={dynasty?.currentRulerId}
          worldMonth={worldMonth}
          factionStatus={team.status}
          team={team}
          events={groupedEvents}
          factionById={factionById}
          selectedRulerId={rulerDetailId}
          onSelectedRulerIdChange={onRulerDetailIdChange}
          onOpenFullGenealogy={openFullGenealogy}
        />
      ) : null}
      <GenealogyDialog
        open={genealogyViewerOpen}
        onClose={closeFullGenealogy}
        dynasty={dynasty}
        rulers={dynasty?.rulers ?? []}
        currentRulerId={dynasty?.currentRulerId}
        team={team}
      />
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
  const activeRelations = Diplomacy.list(worldMonth);
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
              <Box component="span" sx={{ display: "inline-flex", gap: 0.25, ml: 0.45, verticalAlign: "middle" }}>
                {getFactionDiplomacyBadges(activeRelations, team.name).map(({ relation, counterpartId }) => {
                  const counterpart = teams.find((candidate) => candidate.name === counterpartId);
                  const short = relation.status === "TRUCE" ? "停" : relation.status === "ALLIANCE" ? "盟" : "约";
                  const counterpartName = counterpart?.displayName ?? counterpartId;
                  const full = relation.status === "TRUCE" ? "停战" : relation.status === "ALLIANCE" ? "战略同盟" : "互不侵犯";
                  return (
                    <Box
                      component="span"
                      key={`${relation.factionAId}:${relation.factionBId}`}
                      title={`${counterpartName} · ${full} · ${formatWorldDate(relation.startedMonth)}订立 · 约期${formatWorldDuration(relation.expiresMonth - relation.startedMonth)} · 至${formatWorldDate(relation.expiresMonth)}`}
                      sx={{
                        display: "inline-flex", alignItems: "center", gap: 0.2,
                        px: 0.3, border: `1px solid ${counterpart ? colorToString(counterpart.color) : "var(--gg-border)"}`,
                        borderRadius: "999px", fontSize: "0.61rem", lineHeight: 1.4, whiteSpace: "nowrap",
                      }}
                    >
                      <Box component="span" sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: counterpart ? colorToString(counterpart.color) : "var(--gg-border)" }} />
                      {short}·{counterpartName}
                    </Box>
                  );
                })}
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
            <span>{formatStatus(team.status, team.terminationReason)}</span>
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
  dynasty,
  rulers,
  currentRulerId,
  worldMonth,
  factionStatus,
  team,
  events,
  factionById,
  selectedRulerId,
  onSelectedRulerIdChange,
  onOpenFullGenealogy,
}: {
  dynasty?: Dynasty;
  rulers: Ruler[];
  currentRulerId?: string | null;
  worldMonth: number;
  factionStatus: RootState["root"]["teams"][number]["status"];
  team: RootState["root"]["teams"][number];
  events: WorldEvent[];
  factionById: Map<string, RootState["root"]["teams"][number]>;
  selectedRulerId?: string;
  onSelectedRulerIdChange: (id: string | undefined) => void;
  onOpenFullGenealogy: () => void;
}) {
  const livingCandidates = (dynasty?.heirIds ?? [])
    .map((id) => rulers.find((ruler) => ruler.id === id))
    .filter((ruler): ruler is Ruler => Boolean(ruler && ruler.status === "heir"));
  const designatedHeir = livingCandidates.find((candidate) => candidate.id === dynasty?.designatedHeirId);
  const otherCandidates = livingCandidates.filter((candidate) => candidate.id !== dynasty?.designatedHeirId);
  const formalRulers = getFormalRulers(rulers);
  if (formalRulers.length === 0 && livingCandidates.length === 0) {
    return (
      <Typography fontSize="0.9rem" color="var(--gg-text-muted)">
        暂无王室记录。
      </Typography>
    );
  }
  const epochPresentation = getHouseEpochPresentation(dynasty?.houseEpochs ?? []);
  const orderedRulers = [...formalRulers].sort((a, b) => {
    const rank = (ruler: Ruler) => ruler.id === currentRulerId ? 0 : 1;
    return rank(a) - rank(b) || (b.accessionYear ?? -1) - (a.accessionYear ?? -1);
  });
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button size="small" onClick={onOpenFullGenealogy}>查看完整宗谱</Button>
      </Box>
      {designatedHeir ? (
        <Box sx={{ p: 0.8, border: "1px solid var(--gg-border)", borderRadius: "var(--gg-radius)", background: "var(--gg-panel)" }}>
          <Typography fontWeight="bold" fontSize="0.86rem">储君</Typography>
          <Typography fontSize="0.84rem">
            {formatRulerName(designatedHeir)} · {Math.floor(monthsToYears(worldMonth - designatedHeir.bornYear))}岁 · {currentRulerId ? formatRecordedKinship(designatedHeir, rulers.find((ruler) => ruler.id === currentRulerId) ?? designatedHeir, rulers) : "关系未记录"}
            {dynasty?.designatedSinceMonth !== undefined ? ` · 立储${formatWorldDuration(Math.max(0, worldMonth - dynasty.designatedSinceMonth))}` : ""}
          </Typography>
        </Box>
      ) : null}
      {otherCandidates.length ? (
        <Box sx={{ p: 0.8, border: "1px solid var(--gg-border)", borderRadius: "var(--gg-radius)", background: "var(--gg-panel)" }}>
          <Typography fontWeight="bold" fontSize="0.86rem">宗室候选</Typography>
          {otherCandidates.map((candidate) => {
            const current = rulers.find((ruler) => ruler.id === currentRulerId);
            return <Typography key={candidate.id} fontSize="0.84rem">
              {formatRulerName(candidate)} · {Math.floor(monthsToYears(worldMonth - candidate.bornYear))}岁 · {current ? formatRecordedKinship(candidate, current, rulers) : "关系未记录"}
            </Typography>;
          })}
        </Box>
      ) : null}
      {epochPresentation.current ? <Box sx={{ borderTop: "1px solid var(--gg-border)", pt: 0.5 }}>
        <Typography fontWeight="bold" fontSize="0.9rem">当前王统</Typography>
        <Typography fontSize="0.85rem">{epochPresentation.current.text}</Typography>
      </Box> : null}
      {epochPresentation.historical.length ? <Box>
        <Typography fontWeight="bold" fontSize="0.9rem">历代王统</Typography>
        {epochPresentation.historical.map(epoch => <Typography key={epoch.key} fontSize="0.85rem">{epoch.text}</Typography>)}
      </Box> : null}
      <Typography fontWeight="bold" fontSize="0.9rem">历代君主</Typography>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {orderedRulers.map((ruler, index) => {
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
                  {formatRulerRowName(ruler, team)}{ruler.relationType === "USURPER" ? "【篡朝】" : ""}
                </Typography>
                <Typography fontSize="0.82rem" color="var(--gg-text-muted)">
                  {formatRulerListSubtitle(ruler, worldMonth, factionStatus, events, team.name)}
                </Typography>
                <>
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
                </>
              </Box>
              {expanded ? (
                <Box sx={{ mt: 0.65 }}>
                  <RulerBiography ruler={ruler as FormalRuler} rulers={rulers} worldMonth={worldMonth} team={team} events={events} factionById={factionById} />
                </Box>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function GenealogyDialog({
  open,
  onClose,
  dynasty,
  rulers,
  currentRulerId,
  team,
}: {
  open: boolean;
  onClose: (source: GenealogyViewerCloseSource, muiReason?: string) => void;
  dynasty?: Dynasty;
  rulers: Ruler[];
  currentRulerId?: string | null;
  team: RootState["root"]["teams"][number];
}) {
  const [scale, setScale] = useState(1);
  const viewportRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const genealogy = buildGenealogyOnDemand(open, () => buildPoliticalGenealogy(
    rulers,
    currentRulerId,
    dynasty?.designatedHeirId,
    dynasty?.heirIds ?? []
  )) ?? [];
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const update = () => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(viewport);
    if (treeRef.current) observer.observe(treeRef.current);
    return () => observer.disconnect();
  }, [open]);
  const treeWidth = treeRef.current?.scrollWidth ?? 0;
  const treeHeight = treeRef.current?.scrollHeight ?? 0;
  const genealogyCanvas = getGenealogyCanvasLayout(
    treeWidth,
    treeHeight,
    viewportSize.width,
    viewportSize.height,
    scale
  );
  const fitGenealogyToWindow = () => {
    setScale(getGenealogyFitScale(
      treeRef.current?.scrollWidth ?? 0,
      treeRef.current?.scrollHeight ?? 0,
      viewportRef.current?.clientWidth ?? 0,
      viewportRef.current?.clientHeight ?? 0
    ));
    if (viewportRef.current) {
      viewportRef.current.scrollTo({ left: 0, top: 0, behavior: "smooth" });
    }
  };
  const locateCurrentRuler = () => {
    const currentNode = treeRef.current?.querySelector<HTMLElement>(`[data-ruler-id="${currentRulerId}"]`);
    currentNode?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  };
  return (
    <Dialog
      open={open}
      onClose={(_, reason) => {
        onClose(reason === "escapeKeyDown" ? "ESCAPE" : "BACKDROP", reason);
      }}
      fullWidth
      maxWidth="xl"
      PaperProps={{ sx: { width: "90vw", height: "84vh", maxWidth: 1500, display: "flex", flexDirection: "column" } }}
    >
      <DialogTitle sx={{ pb: 0.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="h6">政治宗谱</Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Button size="small" onClick={() => setScale((value) => clampGenealogyScale(value - GENEALOGY_SCALE_STEP))} disabled={scale <= 0.5}>－</Button>
          <Button size="small" onClick={() => setScale(1)} sx={{ minWidth: 48 }}>{Math.round(scale * 100)}%</Button>
          <Button size="small" onClick={() => setScale((value) => clampGenealogyScale(value + GENEALOGY_SCALE_STEP))} disabled={scale >= 1.6}>＋</Button>
          <Button size="small" onClick={fitGenealogyToWindow}>适应窗口</Button>
          <Button size="small" onClick={locateCurrentRuler} disabled={!currentRulerId}>定位当今君主</Button>
          <Button size="small" onClick={() => onClose("EXPLICIT")}>关闭</Button>
        </Box>
      </DialogTitle>
      <DialogContent ref={viewportRef} sx={{ display: "flex", flexDirection: "column", minHeight: 0, overflow: "auto" }}>
        {genealogy.length ? (
          <Box sx={{ position: "relative", width: genealogyCanvas.width, height: genealogyCanvas.height, minWidth: "100%", minHeight: "100%" }}>
            <Box ref={treeRef} sx={{ position: "absolute", left: genealogyCanvas.left, top: genealogyCanvas.top, width: "max-content", transform: `scale(${scale})`, transformOrigin: "top left", display: "flex", alignItems: "flex-start", gap: 3, py: 2 }}>
              {genealogy.map((root) => <GenealogyTreeNode key={root.ruler.id} node={root} dynasty={dynasty} currentRulerId={currentRulerId} team={team} />)}
            </Box>
          </Box>
        ) : <Typography color="var(--gg-text-muted)">暂无可展示的宗谱关系。</Typography>}
      </DialogContent>
    </Dialog>
  );
}

function GenealogyTreeNode({
  node,
  dynasty,
  currentRulerId,
  team,
}: {
  node: ReturnType<typeof buildPoliticalGenealogy>[number];
  dynasty?: Dynasty;
  currentRulerId?: string | null;
  team: RootState["root"]["teams"][number];
}) {
  const ruler = node.ruler;
  const badges = [
    ruler.relationType === "USURPER" ? "篡朝" : undefined,
    ruler.displacedByUsurpationMonth !== undefined ? "旧朝宗亲" : undefined,
    ruler.id === currentRulerId ? "当前" : undefined,
    ruler.id === dynasty?.designatedHeirId ? "储君" : undefined,
    dynasty?.heirIds.includes(ruler.id) && ruler.id !== dynasty.designatedHeirId ? "宗室候选" : undefined,
    ruler.chronicle?.foundedStateName ? "开国" : undefined,
    ruler.chronicle?.proclaimedEmperorMonth !== undefined ? "称帝" : undefined,
    ruler.endReason === "彻底灭亡" ? "亡国" : undefined,
    ruler.chronicle && ruler.chronicle.restorationsDuringReign > 0 ? "复国" : undefined,
    ruler.reignOrdinal !== undefined ? `第${ruler.reignOrdinal}代` : ruler.status === "kin" ? "在世宗亲" : undefined,
  ].filter(Boolean);
  return (
    <Box data-ruler-id={ruler.id} sx={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto", position: "relative", px: 0.5 }}>
      <Box sx={{ border: "1px solid var(--gg-border)", borderRadius: "var(--gg-radius)", px: 0.8, py: 0.45, background: ruler.id === currentRulerId ? "var(--gg-panel)" : "transparent", whiteSpace: "nowrap" }}>
        <Typography fontSize="0.83rem" fontWeight={ruler.id === currentRulerId || ruler.id === dynasty?.designatedHeirId ? 700 : 400}>
          {formatRulerRowName(ruler, team)} <Box component="span" color="var(--gg-text-muted)">· {badges.join(" · ") || "宗室成员"}</Box>
        </Typography>
      </Box>
      {node.children.length ? (
        <Box sx={{ display: "flex", position: "relative", pt: 1.5, mt: 0.15, gap: 0.5, alignItems: "flex-start", "&::before": { content: '""', position: "absolute", top: 0, left: "50%", height: 12, borderLeft: "1px solid var(--gg-border)" } }}>
          {node.children.map((child, index) => (
            <Box key={child.ruler.id} sx={{ position: "relative", pt: 1.5, "&::before": { content: '""', position: "absolute", top: 0, left: "50%", height: 12, borderLeft: "1px solid var(--gg-border)" }, ...(node.children.length > 1 && index === 0 ? { "&::after": { content: '""', position: "absolute", top: 0, left: "50%", right: "-50%", borderTop: "1px solid var(--gg-border)" } } : {}), ...(node.children.length > 1 && index === node.children.length - 1 ? { "&::after": { content: '""', position: "absolute", top: 0, left: "-50%", right: "50%", borderTop: "1px solid var(--gg-border)" } } : {}), ...(node.children.length > 2 && index > 0 && index < node.children.length - 1 ? { "&::after": { content: '""', position: "absolute", top: 0, left: "-50%", right: "-50%", borderTop: "1px solid var(--gg-border)" } } : {}) }}>
              <GenealogyTreeNode node={child} dynasty={dynasty} currentRulerId={currentRulerId} team={team} />
            </Box>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}

function RulerBiography({
  ruler,
  rulers,
  worldMonth,
  team,
  events,
  factionById,
}: {
  ruler: FormalRuler;
  rulers: Ruler[];
  worldMonth: number;
  team: RootState["root"]["teams"][number];
  events: WorldEvent[];
  factionById: Map<string, RootState["root"]["teams"][number]>;
}) {
  const [showAllEvents, setShowAllEvents] = useState(false);
  const reignEnd = ruler.endYear ?? worldMonth;
  const reignMonths = Math.max(0, reignEnd - ruler.accessionYear);
  const accessionAge = Math.floor(monthsToYears(ruler.accessionYear - ruler.bornYear));
  const finalAge = Math.floor(monthsToYears(reignEnd - ruler.bornYear));
  const assessment = deriveRulerAssessment({
    ruler,
    dynasty: { rulers },
    faction: team,
    events,
    worldMonth,
  });
  const historianVoice = composeHistorianVoice(assessment.evidence);
  const tags = buildRulerTags(assessment.evidence);
  const tenure = assessment.evidence.tenure;
  const historicalEvents = getRulerHistoricalEvents(
    events,
    ruler,
    team.name,
    worldMonth,
    ruler.chronicle.notableEventIds,
    showAllEvents ? 1000 : 6
  );
  const heirDeathEvents = events.filter((event) =>
    event.type === "heir-died" && event.metadata?.parentRulerId === ruler.id
  ).sort((a, b) => (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year));
  const heirDeathIds = new Set(heirDeathEvents.map((event) => event.id));
  const rulerEvents = historicalEvents.filter((event) => !heirDeathIds.has(event.id));
  const start = ruler.chronicle.accessionSnapshot;
  const end = ruler.chronicle.endSnapshot ?? ruler.chronicle.latestSnapshot ?? start;
  const territoryDelta = getRulerTerritoryDelta(ruler.chronicle);
  const posthumousLines = getPosthumousLabelLines(ruler, team, ruler.endYear ?? worldMonth);
  const parent = ruler.parentId ? rulers.find((candidate) => candidate.id === ruler.parentId) : undefined;
  const predecessor = ruler.predecessorId ? rulers.find((candidate) => candidate.id === ruler.predecessorId) : undefined;
  const grandparent = parent?.parentId ? rulers.find((candidate) => candidate.id === parent.parentId) : undefined;
  return (
    <Box
      sx={{
        border: "1px solid var(--gg-border)",
        borderRadius: "var(--gg-radius)",
        p: 1,
        background: "var(--gg-panel)",
      }}
    >
      <Typography fontWeight="bold">{ruler.endYear !== undefined && (ruler.templeName || ruler.posthumousEpithet) ? formatPosthumousRulerName(ruler, team, ruler.endYear) : formatRulerName(ruler)}</Typography>
      <Typography fontSize="0.85rem" color="var(--gg-text-muted)">
        {ruler.houseName} ·{" "}
        {ruler.reignOrdinal ? `第${ruler.reignOrdinal}代君主 · ` : ""}
        {formatWorldDate(ruler.accessionYear)}～
        {ruler.endYear !== undefined ? formatWorldDate(ruler.endYear) : "今"}
      </Typography>
      <Typography fontSize="0.85rem">
        {tenure.exileMonths > 0 || tenure.exiledAtAccession || tenure.lostStateDuringTenure
          ? `承统：${formatWorldDuration(tenure.totalTenureMonths)} · 在国：${formatWorldDuration(tenure.activeRuleMonths)} · 流亡：${formatWorldDuration(tenure.exileMonths)}`
          : `在位：${formatWorldDuration(reignMonths)}`}
      </Typography>
      <Typography fontSize="0.85rem">
        即位年龄：{accessionAge} 岁 · {ruler.endYear !== undefined ? "享年" : "当前年龄"}：
        {finalAge} 岁
        {ruler.endReason ? ` · ${ruler.endReason}` : ""}
      </Typography>
      <Typography fontSize="0.82rem" color="var(--gg-text-muted)">
        继承关系：{predecessor && ["DIRECT_CHILD", "GRANDCHILD", "SIBLING", "NEPHEW", "UNCLE", "COUSIN", "COLLATERAL_KIN"].includes(ruler.relationType ?? "")
          ? formatRecordedSuccessionKinship(ruler, predecessor, rulers)
          : formatRulerRelation(ruler.relationType, team.identityStage, Boolean(parent), Boolean(ruler.chronicle?.foundedStateName))}
      </Typography>
      {ruler.predecessorId ? (
        <Typography fontSize="0.82rem" color="var(--gg-text-muted)">
          继位背景：{getSuccessionBackground(ruler, rulers)}
        </Typography>
      ) : null}
      {heirDeathEvents.length ? (
        <Box sx={{ mt: 0.55 }}>
          <Typography fontWeight="bold" fontSize="0.82rem">储嗣</Typography>
          {heirDeathEvents.map((event) => (
            <Typography key={event.id} fontSize="0.82rem">
              {stringMetadata(event.metadata?.heirName)} · {event.metadata?.age ?? "—"}岁 · {formatWorldDate(event.monthIndex ?? event.year)}先于父君{event.metadata?.reason === "combat" ? "战死" : event.metadata?.reason === "captured" ? "被俘处死" : "去世"}
            </Typography>
          ))}
        </Box>
      ) : null}
      <Typography fontSize="0.82rem" color="var(--gg-text-muted)">
        世系：{formatRulerLineage(
          ruler.relationType,
          parent ? formatRulerRowName(parent, team) : undefined,
          team.identityStage,
          Boolean(ruler.chronicle?.foundedStateName)
        )}
        {ruler.relationType !== "LEADER_SUCCESSOR" && grandparent
          ? `；祖父：${formatRulerRowName(grandparent, team)}`
          : ""}
      </Typography>
      {posthumousLines.length > 0 ? (
        <Box sx={{ mt: 0.5 }}>
          <Typography fontWeight="bold" fontSize="0.82rem">身后称号</Typography>
          {posthumousLines.filter((line) => !line.startsWith("史称：")).map((line) => <Typography key={line} fontSize="0.82rem">{line}</Typography>)}
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
        在位统计
      </Typography>
      <Typography fontSize="0.82rem">
        {getSignificantReignStats(ruler.chronicle)}
      </Typography>
      <Typography fontWeight="bold" fontSize="0.86rem" sx={{ mt: 0.75 }}>
        大事记
      </Typography>
      {rulerEvents.length > 0 ? rulerEvents.map((event) => (
        <Typography key={event.id} fontSize="0.82rem">
          {formatWorldDate(event.monthIndex ?? event.year)} ◆ {formatRulerDiplomacyEvent(event, factionById) ?? formatFactionHistoryEvent(event, team.name, factionById) ?? formatHistoryEventTitle(event, factionById)}
        </Typography>
      )) : (
        <Typography fontSize="0.82rem" color="var(--gg-text-muted)">
          暂无已关联的重大历史事件。
        </Typography>
      )}
      {rulerEvents.length >= 6 ? <Button size="small" onClick={() => setShowAllEvents((value) => !value)} sx={{ px: 0, minWidth: 0 }}>{showAllEvents ? "收起" : "查看全部"}</Button> : null}
      <Typography fontWeight="bold" fontSize="0.86rem" sx={{ mt: 0.75 }}>
        {assessment.heading}
      </Typography>
      {assessment.lines.map((line) => (
        <Typography key={line} fontSize="0.82rem">
          {line}
        </Typography>
      ))}
      {historianVoice ? (
        <Box sx={{ mt: 0.55 }}>
          <Typography fontWeight="bold" fontSize="0.82rem">史家曰</Typography>
          <Typography fontSize="0.82rem">{historianVoice}</Typography>
        </Box>
      ) : null}
    </Box>
  );
}

type FormalRuler = Ruler & {
  accessionYear: number;
  chronicle: NonNullable<Ruler["chronicle"]>;
  reignOrdinal: number;
};

function isFormalRuler(ruler: Ruler): ruler is FormalRuler {
  return isFormalRulerRecord(ruler);
}

function stringMetadata(value: string | number | undefined) {
  return typeof value === "string" ? value : "储君";
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
  if (status === "kin") return "在世宗亲";
  if (status === "dead") {
    return "已故";
  }
  if (status === "abdicated") return "合邦退位";
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
  factionStatus?: RootState["root"]["teams"][number]["status"],
  events: WorldEvent[] = [],
  factionId = ""
) {
  if (isFormalRuler(ruler)) {
    const reignEnd = ruler.endYear ?? worldMonth;
    const reignMonths = Math.max(0, reignEnd - ruler.accessionYear);
    const tenure = deriveRulerTenureEvidence(ruler, factionId, events, worldMonth);
    if (tenure.exileMonths > 0 || tenure.exiledAtAccession || tenure.lostStateDuringTenure) {
      return `第${ruler.reignOrdinal}代 · 承统${formatWorldDuration(tenure.totalTenureMonths)} · 在国${formatWorldDuration(tenure.activeRuleMonths)} · 流亡${formatWorldDuration(tenure.exileMonths)}`;
    }
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
      {events.map((event) => (
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

function formatStatus(status: string, terminationReason?: string) {
  if (status === "ACTIVE") {
    return "存续";
  }
  if (status === "EXILED") {
    return "流亡";
  }
  return terminationReason === "MERGED" ? "已合邦" : "灭绝";
}

function TrendChart({
  title,
  color,
  colorHistory,
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
  colorHistory?: FactionColorHistoryEntry[];
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
  const chartId = useId().replace(/:/g, "");
  const historicalColor = (month: number) => getFactionColorAtMonth({ color, colorHistory }, month);
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
      <Box sx={{ height: 24, mt: 0.25, borderBottom: "1px solid var(--gg-border)" }}>
        <svg width="100%" height="24" viewBox="0 0 260 24" role="img" aria-label="历史事件轨道">
          {markers.map((event, index) => {
            const x = monthToChartX(event.monthIndex ?? event.year, snapshots);
            const markerTitle = formatHistoryEventTitle(event, factionById);
            const selected = selectedEventId === event.id;
            return (
              <g
                key={event.id}
                onMouseEnter={() => setHover(`事件：${formatWorldDate(event.monthIndex ?? event.year)} ${markerTitle}`)}
                onMouseLeave={() => setHover(undefined)}
                onClick={() => onEventSelect?.(event.id)}
                style={{ cursor: onEventSelect ? "pointer" : "default" }}
              >
                <text x={x} y={getEventMarkerLaneY(index) - 1} textAnchor="middle" fontSize={selected ? "13" : "10"} fill={colorToString(historicalColor(event.monthIndex ?? event.year))}>◆</text>
              </g>
            );
          })}
        </svg>
      </Box>
      <svg width="100%" height="128" viewBox="0 0 260 120" role="img" aria-label={`${title}数据图`}>
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
        {(colorHistory?.length ? colorHistory : [{ color, startMonth: 0, endMonth: undefined, reason: "FOUNDING" }]).map((epoch, index) => {
          const left = Math.max(32, Math.min(246, monthToChartX(epoch.startMonth, snapshots)));
          const right = epoch.endMonth === undefined ? 246 : Math.max(32, Math.min(246, monthToChartX(epoch.endMonth + 1, snapshots)));
          const clipId = `${chartId}-epoch-${index}`;
          return <g key={clipId}>
            <defs><clipPath id={clipId}><rect x={left} y="0" width={Math.max(0, right - left)} height="120" /></clipPath></defs>
            <polyline points={path} clipPath={`url(#${clipId})`} fill="none" stroke={colorToString(epoch.color)} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          </g>;
        })}
        {points.map((point) => (
          <circle
            key={`${point.month}-${point.value}`}
            cx={point.x}
            cy={point.y}
            r="3"
            fill={colorToString(historicalColor(point.month))}
            onMouseEnter={() =>
              setHover(`数据：${formatWorldDate(point.month)} ${title}：${valueLabel(point.value)}`)
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
  return 94 - ((value - min) / Math.max(1, max - min)) * 64;
}
