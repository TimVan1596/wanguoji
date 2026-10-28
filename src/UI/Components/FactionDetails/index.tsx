import MilitaryArchiveWindow from './MilitaryArchiveWindow';
import {militaryPosthumousLabel} from '../../../Politics/MilitaryHonors';
import {militaryPoliticalLife,appendMilitaryPoliticalLife} from "../../../Politics/MilitaryPoliticalLife";
import GenealogyBrowser from "./GenealogyBrowser";
import PersonLifeDates from "./PersonLifeDates";
import {militaryIdentityLabels} from "../../../Politics/RoyalArchiveIdentity";
import {RoyalMilitaryRoster} from "./RoyalMilitaryPanel";
import {getFactionDisplayNameAtMonth} from "../../../Simulation/FactionIdentity";
import PortraitSummary from "./PortraitSummary";
import {resolvePersonArchiveTarget} from "./PersonArchiveTarget";
import {PersonArchiveNavigation,usePersonArchiveNavigation,type PersonArchiveTarget} from "./PersonArchiveNavigation";
import {RulerServicePanel,MilitaryServicePanel} from "./PersonServicePanel";
import {royalPortraitContext,militaryPortraitContext} from "./PortraitPresentation";
import DepositionSelectionDetails from "../DepositionSelectionDetails";
import MeritRoll,{NobleHistory} from "./MeritRoll";
import {nobleLabel} from "../../../Politics/MilitaryNobility";
import PersonArchiveCard from "./PersonArchiveCard";
import {militaryMilestones,selectMilitaryMilestones} from "./PersonChroniclePresentation";
import {MILITARY_OFFICES,MILITARY_OFFICE_NAMES} from "../../../Politics/MilitaryOffice";
import {describeMilitaryNameEvidence} from "../../../Politics/MilitaryPersonIdentity";
import {describeMilitaryOffice} from "../../../Politics/MilitaryOffice";
import PersonChronicleLayout, {ChronicleSection} from "./PersonChronicleLayout";
import {composeRulerBiography,composeMilitaryBiography} from "../../../Politics/PersonBiography";
import {reconcileMilitaryPersonSelection,toggleMilitaryPerson,type MilitaryPersonSelection} from "./MilitaryPersonSelection";
import {resolveMilitaryCommandView} from "../../../Game/MilitaryCommandOverlay";
import MilitaryPersonIdentityHeader from "./MilitaryPersonIdentityHeader";
import HistoricalEvidence from "../HistoricalEvidence";
import { buildPopulationRecoveryLines } from "./PopulationPresentation";
import HistoricalEventArchive from "./HistoricalEventArchive";
import { getDiplomacyEventDetails } from "../../../History/DiplomacyEventDetails";
import { formatRulerMilitaryEvent } from "../../../Politics/MilitaryChronicle";
import { deriveRestorationTenureEvidence } from "../../../Simulation/RestorationTenureEvidence";
import { buildRestorationMemoryLines } from "./model";
import { UnifiedFactionChronicle } from "./UnifiedFactionChronicle";
import { hasRecordedRulerDeath } from "../../../Politics/RulerLifeState";
import { getTerminationTargetName } from "./model";
import { formatRulerTerminalEvent } from "../../../History/PoliticalTerminalChronicle";
import { formatReignTerritoryChange, getReignTrajectoryPresentation, formatRulerLifeAge, rulerPortraitAge } from "./RoyalPresentation";
import { getFactionColorAtMonth, type FactionColorHistoryEntry } from "../../../Simulation/FactionColorHistory";
import { Box, Button, FormControl, InputLabel, MenuItem, Select, Typography, type SelectChangeEvent } from "@mui/material";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getFactionStability } from "../../../Components/City";
import Game from "../../../Game/Game";
import { colorToString } from "../../../paid/theme";
import DynastyRegistry, { Dynasty, Ruler } from "../../../Politics/Dynasty";
import Diplomacy from "../../../Politics/Diplomacy";
import MilitaryCommandRegistry from "../../../Politics/MilitaryCommandRegistry";
import { getMilitaryParticipationDetails, describeMilitaryPoliticalBlock } from "../../../Politics/MilitaryPoliticalInfluence";
import { describeMilitaryAge, describeMilitaryStatus, describeMilitaryAppointmentEnd, describeMilitaryDeathCause, sortMilitaryPeople,getMilitaryArchive,getMilitaryLocalServiceMonths,getMilitaryLocalFormation } from "./MilitaryPeoplePresentation";
import { getMilitaryPersonDisplayName } from "../../../Politics/MilitaryPersonIdentity";
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
  sortHistoricalFactions,
  type HistoricalFactionSort,
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
  getFactionTerritoryDisplay,
} from "../../../Simulation/TerritoryMetrics";
import {
  getFactionListDisplayName,
  getFactionRegimeBadge,
  getFactionRegimeWeight,
} from "../../../Simulation/FactionDisplayRules";
import {
  getRulerHistoricalEvents,
  getRulerDiplomaticEvents,
} from "../../../Politics/RulerChronicle";
import { deriveRulerAssessment } from "../../../Politics/RulerHistoriography";
import { deriveRulerTenureEvidence } from "../../../Politics/RulerTenureEvidence";
import { getFormalRulers, isFormalRulerRecord } from "../../../Politics/RulerPresentationRules";
import {
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
  buildTerminalFactionArchiveDetails,
  buildStateFormationStatusLines,
  getCumulativeActiveMonthsSafe,
} from "./model";
import { buildNotableRulerIndexEntry } from "./notableRulerIndex";
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
  const [historicalFactionSort, setHistoricalFactionSort] =
    useState<HistoricalFactionSort>("terminal-recent");
  const [historyRevision, setHistoryRevision] = useState(() => WorldHistory.getRevision());
  const [rulerDetailId, setRulerDetailId] = useState<string | undefined>();
  const [genealogyTarget,setGenealogyTarget]=useState<(PersonArchiveTarget&{serial:number})|undefined>();
  const [militaryTarget,setMilitaryTarget]=useState<(PersonArchiveTarget&{serial:number})|undefined>();
  const navigationSequence=useRef(0),navigationDispatch=useDispatch();
  const openPerson=(target:PersonArchiveTarget)=>{
    const resolved=resolvePersonArchiveTarget(target,teams,DynastyRegistry.getAll(),MilitaryCommandRegistry.getPeople());
    if(!resolved)return;
    if(target.kind==="GENEALOGY"){
      setGenealogyTarget({...target,serial:++navigationSequence.current});
    }else if(target.kind==="RULER"){
      setRulerDetailId(target.id);setMilitaryTarget(undefined);
    }else{
      setMilitaryTarget({...target,serial:++navigationSequence.current});
    }
    navigationDispatch(setSelectedFactionName(target.factionId));
    navigationDispatch(setFactionDetailTab(resolved.tab));
  };

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
        historicalSort={historicalFactionSort}
        onHistoricalSortChange={setHistoricalFactionSort}
      />
    );
  }

  return (
    <PersonArchiveNavigation.Provider value={{open:openPerson,militaryTarget,genealogyTarget,consumeGenealogy:()=>setGenealogyTarget(undefined),consume:()=>setMilitaryTarget(undefined)}}><FactionProfile
      team={team}
      teams={teams}
      worldMonth={worldMonth}
      tab={tab}
      events={events}
      rulerDetailId={rulerDetailId}
      onRulerDetailIdChange={setRulerDetailId}
    /></PersonArchiveNavigation.Provider>
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
  const archiveNavigation=usePersonArchiveNavigation();
  const [genealogyTargetId,setGenealogyTargetId]=useState<string>();
  const openFullGenealogy = (id?:string) => {
    setGenealogyTargetId(id);
    genealogyViewerOpenRef.current = true;
    setGenealogyViewerOpen(true);
    recordGenealogyViewerOpen();
  };
  useEffect(()=>{
    const t=archiveNavigation.genealogyTarget;
    if(t?.factionId===team.name){openFullGenealogy(t.id);archiveNavigation.consumeGenealogy();}
  },[archiveNavigation.genealogyTarget?.serial,team.name]);
  const closeFullGenealogy = (source: GenealogyViewerCloseSource, muiReason?: string) => {
    genealogyViewerOpenRef.current = false;
    setGenealogyViewerOpen(false);
    recordGenealogyViewerClose(source, muiReason);
  };
  useEffect(() => {
    if (previousFactionIdRef.current !== team.name && genealogyViewerOpenRef.current && archiveNavigation.genealogyTarget?.factionId!==team.name) {
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
    (a, b) => getFactionTerritoryMetric(territoryMetrics,b.name).factionControlledBlocks - getFactionTerritoryMetric(territoryMetrics,a.name).factionControlledBlocks
  );
  const activeCityCount = teams
    .filter((item) => item.status === "ACTIVE")
    .reduce((sum, item) => sum + item.cities.length, 0);
  const territoryDisplay = getFactionTerritoryDisplay(team, factionTerritory);
  const territory = territoryDisplay.currentBlocks;
  const territoryPercent = factionTerritory.absoluteWorldShare;
  const controlledTerritoryPercent = factionTerritory.controlledTerritoryShare;
  const cityShare = activeCityCount > 0 ? (team.cities.length / activeCityCount) * 100 : 0;
  const imperialStrain = calculateImperialStrain(team, totalCells);
  const remnant = WorldRemnants.get(team.name);
  const exile = WorldExiles.get(team.name);
  const snapshots = FactionSnapshots.get(team.name);
  const dynasty = DynastyRegistry.get(team.name);
  const currentRuler = DynastyRegistry.getCurrentRuler(team.name);
  const submittedLastRuler = dynasty?.rulers.find(r => r.endReason === "纳土退位");
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
  const populationSummary = Game.Core?.getPopulationSummary(team.name);
  const populationLines = buildPopulationRecoveryLines(team, worldMonth, populationSummary, populationSummary?.latest, Game.Core?.simulator?.getPopulationClimateMultiplier(team), WorldHistory.getEventsBetween(Math.max(0, worldMonth - 24), worldMonth));
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
  const restorationMemoryLines = useMemo(() => {
    if (team.status !== "EXILED") return [];
    const evidence = deriveRestorationTenureEvidence({ team, dynasty,
      events: WorldHistory.getEventsForFaction(team.name), worldMonth });
    return buildRestorationMemoryLines(evidence, { worldMonth, exileStartedMonth: exile?.startedMonth, lastExiledMonth: team.lastExiledYear,
      legitimacy: exile?.legitimacy, remnants: remnant?.population ?? 0,
      hasClaimant: DynastyRegistry.hasClaimantAtMonth(team.name, worldMonth) });
  }, [team, dynasty, worldMonth, events, exile?.startedMonth, exile?.legitimacy, remnant?.population]);
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
    <Box data-faction-scroll sx={{ p: 1.25, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
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
      {team.terminationReason === "SUBMITTED" && <Typography fontSize="0.84rem">
        纳土归附于 {getTerminationTargetName(team, teams)}
        <br />归附时间：{team.terminationMonth !== undefined ? formatWorldDate(team.terminationMonth) : "—"}
        <br />末代君主：{submittedLastRuler ? `${submittedLastRuler.houseName.replace(/氏$/, "")}${submittedLastRuler.givenName} · 纳土退位` : "—"}
      </Typography>}
      <Typography fontSize="0.84rem" color="var(--gg-text-muted)" sx={{ mt: 0.25 }}>
        {regimeLevel} · {formatStatus(team.status, team.terminationReason)} · 天下第{rankIndex}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.5, my: 1 }}>
        {[
          ["overview", "概览"],
          ["power", "国势"],
          ["house", "王室"],
          ["military", "军政人物"],
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
          {team.origin?.parentFactionId && <OverviewSection title="政权源流" lines={[
            `来源：${team.origin.type === "SPLIT" ? "地方分裂政权" : "地方起事政权"} · ${formatWorldDate(team.origin.foundedMonth)}`,
            `母体国家：${teams.find(t=>t.name===team.origin.parentFactionId)?.displayName ?? team.origin.parentFactionId}`,
            `发源城市：${(team.origin.foundingCityIds ?? []).map(id=>Game.Core?.allCities.find(c=>c.id===id)?.name ?? id).join("、")}`,
            ...WorldHistory.getEventsForFaction(team.name).filter(e=>["rebel-faction-founded","frontier-faction-founded","empire-split"].includes(e.type)&& (e.actorFactionId===team.name||e.metadata?.newFactionId===team.name||e.metadata?.splitFactionId===team.name)).slice(0,1).map(e=>`初始真实支持人口：${e.metadata?.transferredPopulation ?? "未记录"}；额外增员：${e.metadata?.externalPopulation ?? "未记录"}`)
          ]} />}
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
              ...(territoryDisplay.retainedBlockMarkers > 0 ? [`遗留地块标记：${formatNumber(territoryDisplay.retainedBlockMarkers)} 格（非当前控制领土）`] : []),
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
          <OverviewSection title="人口恢复与来源" lines={populationLines} />
          <OverviewSection title="王朝记忆" lines={restorationMemoryLines.length ? [...overviewSections.legacyLines.filter(line => !/^(势力存续|流亡|合法性|残部)：/.test(line)), ...restorationMemoryLines] : overviewSections.legacyLines} />
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
        <Box sx={{ display: "grid", gap: 1 }}>
        <DynastyTree
          key={team.name}
          dynasty={dynasty}
          rulers={dynasty?.rulers ?? []}
          currentRulerId={dynasty?.currentRulerId}
          worldMonth={worldMonth}
          factionStatus={team.status}
          team={team}
          events={events}
          factionById={factionById}
          selectedRulerId={rulerDetailId}
          onSelectedRulerIdChange={onRulerDetailIdChange}
          onOpenFullGenealogy={openFullGenealogy}
        />
        </Box>
      ) : null}
      {activeTab === "military" ? <MilitaryPeoplePanel key={team.name} factionId={team.name} worldMonth={worldMonth} /> : null}
      <GenealogyBrowser
        open={genealogyViewerOpen}
        onClose={closeFullGenealogy}
        dynasty={dynasty}
        targetId={genealogyTargetId}
        team={team}
        worldMonth={worldMonth}
      />
    </Box>
  );
}

function MilitaryPoliticalEventFacts({ event }: { event: WorldEvent }) {
  const lines = getMilitaryParticipationDetails(event);
  return lines.length ? <Box component="details" sx={{ minWidth: 0, overflowWrap: "anywhere", fontSize: "0.78rem" }}>
    <summary>史料依据（军事参与）</summary>
    <Typography fontSize="0.72rem">原事件：{event.id}</Typography>
    {lines.map((line, index) => <Typography key={index} fontSize="0.78rem">{line}</Typography>)}
  </Box> : null;
}

function MilitaryPeoplePanel({ factionId, worldMonth }: { factionId: string; worldMonth: number }) {
  const [archiveView,setArchiveView]=useState<"people"|"merit">("people");
  const [selection, setSelection] = useState<MilitaryPersonSelection>();
  const navigation=usePersonArchiveNavigation();
  const people = sortMilitaryPeople(MilitaryCommandRegistry.getPeople().filter(person => person.factionId === factionId || person.appointments.some(appointment => appointment.factionId === factionId)),factionId);
  const formations = MilitaryCommandRegistry.getFormations();
  const archiveEvents=useMemo(()=>WorldHistory.getEvents(),[worldMonth,WorldHistory.getRevision()]);
  const archiveDynasties=useMemo(()=>DynastyRegistry.getAll(),[worldMonth,WorldHistory.getRevision()]);
  const usersByPerson=new Map((Game.Core?.teams??[]).flatMap(t=>[...t.users]).filter(u=>u.militaryPersonId).map(u=>[u.militaryPersonId!,u]));
  const linkedRulers=new Map(archiveDynasties.flatMap(d=>d.rulers).filter(r=>r.residentIdentity||r.militaryIdentity).map(r=>[r.militaryIdentity?.personId??r.residentIdentity!.personId,r]));
  const liveIds=new Set(people.filter(p=>usersByPerson.get(p.personId)?.matchesMilitaryLife(p)).map(p=>p.personId));
  const resolvedSelection=reconcileMilitaryPersonSelection(selection,factionId,people,formations,liveIds);
  if(resolvedSelection!==selection)setSelection(resolvedSelection);
  useEffect(()=>{
    const target=navigation.militaryTarget;
    if(!target||target.factionId!==factionId)return;
    setArchiveView("people");
    const person=people.find(p=>p.personId===target.id);
    if(person&&!resolvedSelection.expandedIds.includes(person.personId)){
      const active=person.status==="ACTIVE"&&person.factionId===factionId&&liveIds.has(person.personId);
      const manual=active?resolvedSelection.manualExpandedIds:[...new Set([...resolvedSelection.manualExpandedIds,person.personId])];
      setSelection({...resolvedSelection,manualExpandedIds:manual,expandedIds:[...new Set([...resolvedSelection.expandedIds,person.personId])],focusedId:active?person.personId:resolvedSelection.focusedId});
      return;
    }
    navigation.consume();
  },[navigation.militaryTarget?.serial,factionId,resolvedSelection.expandedIds.includes(navigation.militaryTarget?.id??"")]);

  const {currentPeople,visiblePeople}=getMilitaryArchive(people,factionId,formations,liveIds);
  const focusedPerson=people.find(p=>p.personId===resolvedSelection.focusedId);
  const focusedCommand=formations.find(f=>f.commanderPersonId===focusedPerson?.personId&&f.status==="ACTIVE"&&f.factionId===factionId)?.commandId;
  const core=Game.Core;
  useEffect(()=>{
    if(archiveView==="people"&&focusedCommand)core?.showMilitaryCommand(focusedCommand,true);else core?.clearMilitaryCommandHighlight();
    return ()=>core?.clearMilitaryCommandHighlight();
  },[core,factionId,focusedCommand,focusedPerson,archiveView]);

  const politicalTeam = Game.Core?.teams.find(team => team.name === factionId);
  const politicalFactionById = new Map((Game.Core?.teams ?? []).map(team => [team.name, team]));
  const militaryPolitics = politicalTeam && resolvedSelection.expandedIds.length ? MilitaryCommandRegistry.getPoliticalInfluence(politicalTeam, worldMonth, Game.Core?.logicalUnitRegistry) : undefined;
  const diagnostics = MilitaryCommandRegistry.getDiagnostics();
  const officeSummary=resolvedSelection.expandedIds.length?MilitaryCommandRegistry.getOfficeSummary(worldMonth):undefined;
  const factionCommanders = people.filter(person => person.factionId === factionId && person.status === "ACTIVE").length;
  return <Box sx={{ display: "grid", gap: 1, mt: 0.5, minWidth: 0, overflowWrap: "anywhere" }}>
    <Box><button type="button" aria-pressed={archiveView==='people'} onClick={()=>setArchiveView('people')}>现役与历任</button> · <button type="button" aria-pressed={archiveView==='merit'} onClick={()=>setArchiveView('merit')}>功臣录</button></Box>
    {archiveView==='merit'?<MeritRoll factionId={factionId} month={worldMonth} onOpen={id=>{setArchiveView('people');navigation.open({kind:'MILITARY',factionId,id});}}/>:<>
    <Typography fontSize="0.78rem" color="var(--gg-text-muted)">
      现役将领 {factionCommanders} 人 · 历任将领 {people.length} 人
    </Typography>

    <Typography fontSize="0.78rem" color="var(--gg-text-muted)">现役在前；历任人物按最近一次本国离任年月排列。</Typography>
    {!people.length && <Typography fontSize="0.86rem" color="var(--gg-text-muted)">本势力尚无将领任职；需有合格的真实居民，并经过既有年度任命机会，短期存续或兵员不足时可能暂无人选。</Typography>}
    <MilitaryArchiveWindow ids={visiblePeople.map(p=>p.personId)} targetId={navigation.militaryTarget?.id}>{(id,index) => {
      const person=people.find(p=>p.personId===id)!;
      const expanded=resolvedSelection.expandedIds.includes(id);
      const localAppointments=person.appointments.filter(a=>a.factionId===factionId);
      const first=localAppointments[0],last=localAppointments.at(-1),current=currentPeople.includes(person);
      const highest=localAppointments.flatMap(a=>a.officeHistory??[]).sort((a,b)=>MILITARY_OFFICES.indexOf(b.office)-MILITARY_OFFICES.indexOf(a.office))[0];
      const linked=linkedRulers.get(person.personId);
      const royalTeam=linked&&Game.Core?.teams.find(t=>DynastyRegistry.get(t.name)?.rulers.some(r=>r.id===linked.id));
      const portraitContext=linked&&linked.accessionYear!==undefined&&linked.accessionYear<=worldMonth&&royalTeam?{...royalPortraitContext(linked,royalTeam,worldMonth),historical:true}:militaryPortraitContext(person,factionId,politicalTeam,worldMonth);
      const identityLabels=militaryIdentityLabels(person,archiveDynasties,archiveEvents,worldMonth);
      const identityBadges=identityLabels.map(label=>label==="宗室将领"&&person.royalIdentity?<button key={label} type="button" style={{border:0,background:"none",font:"inherit",color:"inherit",textDecoration:"underline",cursor:"pointer"}} onClick={event=>{event.stopPropagation();navigation.open({kind:"GENEALOGY",factionId:person.royalIdentity!.factionId,id:person.royalIdentity!.rulerId});}}>{label}</button>:<span key={label}>{label} · </span>);
      const ageText=linked?formatRulerLifeAge(linked,worldMonth):describeMilitaryAge(person,worldMonth,liveIds.has(person.personId));
      const portraitAge=linked?rulerPortraitAge(linked,worldMonth):person.status==="DEAD"&&person.deathMonth!==undefined?Math.max(0,Math.floor((person.deathMonth-person.bornMonth)/12)):liveIds.has(person.personId)?Math.max(0,Math.floor((worldMonth-person.bornMonth)/12)):undefined;
      return <PersonArchiveCard key={person.personId} index={index} active={current} expanded={resolvedSelection.expandedIds.includes(person.personId)}
        focusRequest={navigation.militaryTarget?.id===person.personId}
        onSelect={()=>setSelection(toggleMilitaryPerson(resolvedSelection,person.personId,current))}
        portrait={<PortraitSummary portrait={{personId:person.personId,age:portraitAge,...portraitContext}} name={getMilitaryPersonDisplayName(person)} lines={[...identityLabels,politicalTeam?getFactionDisplayNameAtMonth(politicalTeam,portraitContext.month):factionId,ageText,describeMilitaryOffice(person,factionId),first?`${formatWorldDate(first.startMonth)}—${last?.endMonth===undefined?"今":formatWorldDate(last.endMonth)}`:""]} onFull={()=>{if(!resolvedSelection.expandedIds.includes(person.personId))setSelection(toggleMilitaryPerson(resolvedSelection,person.personId,current));}}/>}
        heading={<>
          <Typography fontSize="0.92rem" sx={{display:"flow-root"}} fontWeight={current?"bold":600}>{current?"● ":""}{getMilitaryPersonDisplayName(person)} · <Box component="span" sx={{fontSize:"0.76rem",fontWeight:400,color:"var(--gg-text-muted)"}}>{ageText}</Box> · {current?"现役":person.status==="ACTIVE"&&person.factionId!==factionId?"已转属":describeMilitaryStatus(person)}</Typography>
          <Typography fontSize="0.76rem">{[...identityLabels,nobleLabel(person,factionId,worldMonth),militaryPosthumousLabel(person,factionId,worldMonth)].filter(Boolean).join(" · ")}</Typography>
          <Typography fontSize="0.82rem" color="var(--gg-text-muted)">{politicalTeam?.displayName??factionId} · {highest?`最高任${MILITARY_OFFICE_NAMES[highest.office]}`:"军职未载"}</Typography>
          <Typography fontSize="0.8rem" color="var(--gg-text-muted)">{first?`${formatWorldDate(first.startMonth)}—${last?.endMonth===undefined?(current?"今":"止期未载"):formatWorldDate(last.endMonth)}`:"任期未载"} · 军旅纪事展开查看</Typography>
        </>}
      >
        {expanded && (() => {
      const entries=MilitaryCommandRegistry.getChronicle(person,worldMonth,factionId);
      const localEvents=WorldHistory.getEventsForFaction(factionId);
      const politicalLife=militaryPoliticalLife(person,archiveDynasties,archiveEvents,politicalFactionById,worldMonth);
      const allMilestones=appendMilitaryPoliticalLife(militaryMilestones(person,entries,localEvents,{factions:politicalFactionById}),politicalLife);
      const milestones=selectMilitaryMilestones(allMilestones,localEvents,8);

          const formation = getMilitaryLocalFormation(person,factionId,formations);
          const activeUser = [...(Game.Core?.teams.find(team => team.name === person.factionId)?.users ?? [])]
            .find(user => user.militaryPersonId === person.personId);
          const linkedRuler = linked;
          const personAge = linkedRuler ? formatRulerLifeAge(linkedRuler,worldMonth) : describeMilitaryAge(person,worldMonth,Boolean(activeUser?.matchesMilitaryLife(person)));
          const lastAppointment = localAppointments.at(-1);
          const career = MilitaryCommandRegistry.getCareer(person, worldMonth);
          const politicalEvents = MilitaryCommandRegistry.getPoliticalEvents(person);
          const politicalCandidate = militaryPolitics?.candidates.find(p => p.personId === person.personId);
          const orderEvidence = formation ? MilitaryCommandRegistry.getOrderEvidence(formation) : undefined;
          const bio=composeMilitaryBiography(person,entries,factionId);
          const view=formation&&Game.Core?resolveMilitaryCommandView(Game.Core,formation.commandId):undefined;
          return <PersonChronicleLayout
            title={<MilitaryPersonIdentityHeader person={person} country={`${politicalFactionById.get(person.factionId)?.displayName ?? person.factionId}${politicalFactionById.get(person.factionId)?.identityStage === "STATE" ? "国" : ""}`} />}
            identity={<>
              <PersonLifeDates bornMonth={person.bornMonth} deathMonth={person.deathMonth}/>
              <Typography fontSize="0.76rem">{identityBadges}</Typography>
              <Typography fontSize="0.86rem" fontWeight="bold">{describeMilitaryOffice(person,factionId).replace("（本国历史最高职务）","")}</Typography>
              {portraitContext.historical&&<Typography fontSize="0.74rem" color="var(--gg-text-muted)">肖像服饰与旗色取本国任职末期，非其后来外国身份。</Typography>}
            {person.factionId!==factionId&&<Typography fontSize="0.78rem">曾在本国任职，后已转属。</Typography>}
              <Typography fontSize="0.76rem" color="var(--gg-text-muted)">{personAge} · 本国任职：{person.appointments.filter(a=>a.factionId===factionId).map(a=>`${formatWorldDate(a.startMonth)}—${a.endMonth===undefined?"今":formatWorldDate(a.endMonth)}`).join("；")}</Typography>
            </>}
            preBiography={<MilitaryServicePanel personId={person.personId} month={worldMonth}/> }
            biographyTitle="生平" biography={bio.life} milestoneTitle="军旅纪事" milestoneTotal={allMilestones.length} personKey={person.personId}
            allMilestones={()=>allMilestones.map(entry=>({id:entry.eventId,content:<Typography fontSize="0.82rem">{formatWorldDate(entry.worldMonth)} · {entry.text}</Typography>}))}
            milestones={milestones.map(entry=>({id:entry.eventId,content:<Typography fontSize="0.82rem">{formatWorldDate(entry.worldMonth)} · {entry.text}</Typography>}))}
            assessment={[bio.assessment]} voice={bio.voice}
            governance={<ChronicleSection title="军功与任职"><NobleHistory person={person} factionId={factionId} month={worldMonth}/><Typography fontSize="0.82rem">本国历任军职{formatWorldDuration(getMilitaryLocalServiceMonths(person,factionId,worldMonth))}；任内，所部参与取城{bio.victories.length}次；可追溯军旅活动{career.activities.filter(e=>e.factionId===factionId).length}处。</Typography></ChronicleSection>}
            evidence={<>
              <Typography fontSize="0.75rem">人物：{person.personId} / User {person.sourceUserId} / 原人口标签：{person.name}</Typography>
              <Typography fontSize="0.75rem">{describeMilitaryNameEvidence(person)}</Typography>
              <Box component="details" sx={{minWidth:0,overflowWrap:"anywhere"}}><summary>军事系统诊断</summary>
              <Typography fontSize="0.75rem">候选与资格数字是累计检查次数，不是独立人物数；正式军职提供同国任职史料参考，不单独增加政治风险或重复抽签。</Typography>
              <Typography fontSize="0.76rem">军职档案累计授裨将{officeSummary!.pijiang}次、将军{officeSummary!.jiangjun}次、上将军{officeSummary!.shangjiangjun}次；真实晋阶{officeSummary!.promotions}次；平均任期{officeSummary!.meanServiceMonths.toFixed(1)}个月；当前实授军职{officeSummary!.currentOffices.length}人。职序为游戏世界抽象军职，不是统一历史官品；军职不改变统兵上限或政治抽签。</Typography>
              <Typography fontSize="0.76rem" color="var(--gg-text-muted)">
                全世界本次运行累计诊断：候选 {diagnostics.candidates} · 符合资格 {diagnostics.eligible} · 任命 {diagnostics.appointments} · 新命令 {diagnostics.orders} · 转向步进 {diagnostics.unitsSteered} · 到达目标城 {diagnostics.targetCityArrivals} · 围城接触 {diagnostics.commandedSiegeContacts} · 攻陷 {diagnostics.captures} · 目标失效 {diagnostics.invalidatedTargets} · 长期远距命令检查 {diagnostics.staleOrderChecks}
              </Typography>
              <Typography fontSize="0.76rem" color="var(--gg-text-muted)">
                全世界世代更替（本次会话，读取后重置）：年老退役 {diagnostics.ageRetirements} · 自然死亡 {diagnostics.naturalDeaths} · 释放编组 {diagnostics.releasedFormations} · 合法重新任职 {diagnostics.reappointments} · 到龄任命阻断 {diagnostics.ageBlocked} · 原User核验失败 {diagnostics.identityFailures}
              </Typography>
              </Box>
              <HistoricalEventArchive title="全部军旅记录" entries={entries.map(entry=>({id:entry.eventId,content:<>
                <Typography fontSize="0.78rem">{formatWorldDate(entry.worldMonth)} · {allMilestones.find(m=>m.eventId===entry.eventId)?.text??entry.text}</Typography>
                <Typography fontSize="0.72rem">来源：{entry.source} · 编组：{entry.commandId??"未记录"}</Typography>
                {person.appointments.flatMap(a=>a.officeHistory??[]).find(g=>g.eventId===entry.eventId)?.captureEventIds.map(id=><Typography key={id} fontSize="0.72rem">授职战果原事件：{id}</Typography>)}
              </>}))}/>

              <Typography fontSize="0.75rem">资格计数是累计检查次数，不是独立人物数。</Typography>
              <Typography fontSize="0.78rem">军事资历：{career.level} · 权重{career.appointmentWeight.toFixed(2)}×（上限2×，非爵位）；任职{career.appointmentCount}次，再次任职{career.reappointments}次。</Typography>
              <Typography fontSize="0.78rem">军事政治参与资格：{politicalCandidate?`已核验，现役编组${politicalCandidate.unitCount}人`:`不合格：${describeMilitaryPoliticalBlock(militaryPolitics?.blocked.find(b=>b.personId===person.personId)?.reason)}`}</Typography>
              <Typography fontSize="0.78rem">生涯核验普通城市{career.ordinaryCaptures}次、敌都{career.capitalCaptures}次、都城属性未记录{career.unclassifiedCaptures}次；旧生涯权重口径与本页按历史组去重的本国纪事分别保留。</Typography>
              {lastAppointment?.endMonth!==undefined&&<Typography fontSize="0.78rem">最近离职：{describeMilitaryAppointmentEnd(lastAppointment.endReason)}</Typography>}
              {person.deathMonth!==undefined&&<Typography fontSize="0.78rem">死亡来源：{describeMilitaryDeathCause(person.deathCause)}</Typography>}
              {politicalEvents.filter(event=>event.actorFactionId===factionId).map(event=><MilitaryPoliticalEventFacts key={event.id} event={event}/>)}
              {formation&&<HistoricalEvidence eventId={orderEvidence?.id??"军令事件未记录"} commandId={formation.commandId} personId={person.personId}/>}
            </>}
          >
            {bio.ending&&<ChronicleSection title="退役与生命结局"><Typography fontSize="0.82rem">{bio.ending}</Typography></ChronicleSection>}
            {view&&<ChronicleSection title="现役部队与军令">
              <Typography fontSize="0.82rem">统兵{view.members.length}人 · {view.target?`奉命进军${view.target.name}`:"暂未奉进攻军令。"}</Typography>
            </ChronicleSection>}
          </PersonChronicleLayout>;
        })()}
      </PersonArchiveCard>;
    }}</MilitaryArchiveWindow>

    </>}
  </Box>;
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
  historicalSort,
  onHistoricalSortChange,
}: {
  teams: RootState["root"]["teams"];
  worldMonth: number;
  filter: FactionListFilter;
  onFilterChange: (filter: FactionListFilter) => void;
  historicalSort: HistoricalFactionSort;
  onHistoricalSortChange: (sort: HistoricalFactionSort) => void;
}) {
  const filteredTeams = useMemo(() => getVisibleFactions(teams, filter), [teams, filter]);
  const visibleTeams = useMemo(() => filter === "extinct"
    ? sortHistoricalFactions(filteredTeams, historicalSort, worldMonth)
    : [...filteredTeams].sort((a, b) => {
      if (a.status !== b.status) {
        const order = { ACTIVE: 0, EXILED: 1, EXTINCT: 2 };
        return order[a.status] - order[b.status];
      }
      return getCumulativeActiveMonthsSafe(b, worldMonth) - getCumulativeActiveMonthsSafe(a, worldMonth);
    }), [filteredTeams, filter, historicalSort, worldMonth]);
  const archiveLabelById = useMemo(() => createFactionArchiveLabelMap(teams), [teams]);
  const activeRelations = Diplomacy.list(worldMonth);
  return (
    <Box data-faction-scroll sx={{ p: 1.25, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
      <Typography fontWeight="bold" variant="h6">
        天下势力
      </Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.4, my: 0.75 }}>
        {[
          ["all", "全部"],
          ["active", "存续"],
          ["exiled", "流亡"],
          ["extinct", "终结"],
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
      {filter === "extinct" ? (
        <FormControl size="small" fullWidth sx={{ mb: 0.8 }}>
          <InputLabel id="historical-faction-sort-label">终结排序</InputLabel>
          <Select
            labelId="historical-faction-sort-label"
            value={historicalSort}
            label="终结排序"
            onChange={(event: SelectChangeEvent<HistoricalFactionSort>) => onHistoricalSortChange(event.target.value as HistoricalFactionSort)}
            sx={{ fontSize: "0.78rem" }}
          >
            <MenuItem value="terminal-recent">终结时间：由近到远</MenuItem>
            <MenuItem value="terminal-oldest">终结时间：由远到近</MenuItem>
            <MenuItem value="active-longest">累计在国：由长到短</MenuItem>
            <MenuItem value="active-shortest">累计在国：由短到长</MenuItem>
            <MenuItem value="founded-recent">建立时间：由近到远</MenuItem>
            <MenuItem value="restorations-most">复国次数：由多到少</MenuItem>
          </Select>
        </FormControl>
      ) : null}
      <Box sx={{ display: "grid", gap: 0.45 }}>
        {filter !== "extinct" ? (
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
            <span>势力存续</span>
            <span>城</span>
            <span>复国</span>
          </Box>
        ) : null}
        {visibleTeams.map((team) => (
          filter === "extinct" ? (
            <TerminalFactionArchiveCard
              key={team.name}
              team={team}
              worldMonth={worldMonth}
              sort={historicalSort}
              displayName={archiveLabelById.get(team.name) ?? getFactionListDisplayName(team, worldMonth)}
            />
          ) : (
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
                "&:hover": { borderColor: "var(--gg-selected)" },
              }}
            >
              <span>
                <Box component="span" sx={{ display: "inline-block", width: "0.65rem", height: "0.65rem", mr: 0.45, backgroundColor: colorToString(team.color), border: "1px solid rgba(0,0,0,0.35)", verticalAlign: "-0.05rem" }} />
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
                      <Box component="span" key={`${relation.factionAId}:${relation.factionBId}`} title={`${counterpartName} · ${full} · ${formatWorldDate(relation.startedMonth)}订立 · 约期${formatWorldDuration(relation.expiresMonth - relation.startedMonth)} · 至${formatWorldDate(relation.expiresMonth)}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.2, px: 0.3, border: `1px solid ${counterpart ? colorToString(counterpart.color) : "var(--gg-border)"}`, borderRadius: "999px", fontSize: "0.61rem", lineHeight: 1.4, whiteSpace: "nowrap" }}>
                        <Box component="span" sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: counterpart ? colorToString(counterpart.color) : "var(--gg-border)" }} />
                        {short}·{counterpartName}
                      </Box>
                    );
                  })}
                </Box>
                <Box component="span" sx={{ display: "block", mt: 0.1, ml: 1.1, fontSize: "0.66rem", color: getFactionRegimeWeight(team) === 2 ? "#7a4b00" : "var(--gg-text-muted)" }}>
                  {getFactionRegimeBadge(team)}
                </Box>
              </span>
              <span>{formatStatus(team.status, team.terminationReason)}</span>
              <span>{formatWorldDate(team.firstFoundedYear)}</span>
              <span>{formatWorldDuration(getCumulativeActiveMonthsSafe(team, worldMonth))}</span>
              <span>{team.cities.length}</span>
              <span>{team.restorationYears.length || "—"}</span>
            </Box>
          )
        ))}
      </Box>
    </Box>
  );
}

function TerminalFactionArchiveCard({
  team,
  worldMonth,
  sort,
  displayName,
}: {
  team: RootState["root"]["teams"][number];
  worldMonth: number;
  sort: HistoricalFactionSort;
  displayName: string;
}) {
  const details = buildTerminalFactionArchiveDetails(team, worldMonth, sort);
  return (
    <Box
      onClick={() => Game.Core?.selectFaction(team.name)}
      sx={{
        p: 0.7,
        border: "1px solid var(--gg-border)",
        borderRadius: "var(--gg-radius)",
        cursor: "pointer",
        background: "var(--gg-panel)",
        "&:hover": { borderColor: "var(--gg-selected)" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 0.75, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
          <Box component="span" sx={{ flex: "0 0 auto", width: "0.7rem", height: "0.7rem", mr: 0.55, backgroundColor: colorToString(team.color), border: "1px solid rgba(0,0,0,0.35)" }} />
          <Typography
            component="span"
            title={displayName}
            sx={{ minWidth: 0, fontSize: "0.9rem", fontWeight: getFactionRegimeWeight(team) === 2 ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {displayName}
          </Typography>
        </Box>
        <Typography component="span" sx={{ flex: "0 0 auto", whiteSpace: "nowrap", fontSize: "0.83rem", fontWeight: 600 }}>
          {details.terminalDate === undefined ? "—" : formatWorldDate(details.terminalDate)}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 0.45, rowGap: 0.05, mt: 0.2, pl: 1.25, color: "var(--gg-text-muted)" }}>
        <Typography component="span" sx={{ fontSize: "0.76rem", lineHeight: 1.35 }}>
          {details.terminalKind} · 累计在国{details.activeDuration}
        </Typography>
        <Typography component="span" sx={{ fontSize: "0.7rem", lineHeight: 1.35 }}>
          {details.foundedDate ? `初建${details.foundedDate}` : null}
        </Typography>
        {details.showRestorationCount ? (
          <Typography component="span" sx={{ fontSize: "0.7rem", lineHeight: 1.35 }}>
            {details.restorationLabel}
          </Typography>
        ) : null}
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
  onOpenFullGenealogy: (id?:string) => void;
}) {
  const livingCandidates = (dynasty?.heirIds ?? [])
    .map((id) => rulers.find((ruler) => ruler.id === id))
    .filter((ruler): ruler is Ruler => Boolean(ruler && ruler.status === "heir" && ruler.deathMonth === undefined && ruler.deathReason === undefined));
  const designatedHeir = livingCandidates.find((candidate) => candidate.id === dynasty?.designatedHeirId);
  const otherCandidates = livingCandidates.filter((candidate) => candidate.id !== dynasty?.designatedHeirId);
  const formalRulers = getFormalRulers(rulers);
  const archive = dynasty ? <UnifiedFactionChronicle key={team.name} dynasty={dynasty} faction={team} factions={factionById} worldMonth={worldMonth}
    rulersForFaction={id => DynastyRegistry.get(id)?.rulers} /> : null;
  if (formalRulers.length === 0 && livingCandidates.length === 0) {
    return <Box sx={{ display: "grid", gap: 1 }}>{archive}
      <Typography fontSize="0.9rem" color="var(--gg-text-muted)">暂无王室记录。</Typography>
    </Box>;
  }
  const orderedRulers = [...formalRulers].sort((a, b) => {
    const rank = (ruler: Ruler) => ruler.id === currentRulerId ? 0 : 1;
    return rank(a) - rank(b) || (b.accessionYear ?? -1) - (a.accessionYear ?? -1);
  });
  return (
    <Box sx={{ display: "grid", gap: 1 }}>
      {archive}
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Button size="small" onClick={()=>onOpenFullGenealogy()}>查看完整宗谱</Button>
      </Box>
      {designatedHeir ? (
        <Box sx={{ p: 0.8, border: "1px solid var(--gg-border)", borderRadius: "var(--gg-radius)", background: "var(--gg-panel)" }}>
          <Typography fontWeight="bold" fontSize="0.86rem">储君</Typography>
          <Typography component="div" fontSize="0.84rem" sx={{display:"flow-root"}}>
            <Box component="button" type="button" onClick={()=>onOpenFullGenealogy(designatedHeir.id)} aria-label="查看储君宗谱" sx={{p:0,border:0,background:"none",cursor:"pointer",color:"inherit",font:"inherit",textDecoration:"underline"}}>{formatRulerName(designatedHeir)}</Box> · {formatRulerLifeAge(designatedHeir,worldMonth,false,team.status!=="EXTINCT")} · {currentRulerId ? formatRecordedKinship(designatedHeir, rulers.find((ruler) => ruler.id === currentRulerId) ?? designatedHeir, rulers) : "关系未记录"}
            {dynasty?.designatedSinceMonth !== undefined ? ` · 立储${formatWorldDuration(Math.max(0, worldMonth - dynasty.designatedSinceMonth))}` : ""}
          </Typography>
        </Box>
      ) : null}
      {otherCandidates.length ? (
        <Box sx={{ p: 0.8, border: "1px solid var(--gg-border)", borderRadius: "var(--gg-radius)", background: "var(--gg-panel)" }}>
          <Typography fontWeight="bold" fontSize="0.86rem">宗室继承候选</Typography>
          {otherCandidates.map((candidate) => {
            const current = rulers.find((ruler) => ruler.id === currentRulerId);
            return <Typography key={candidate.id} component="div" fontSize="0.84rem" sx={{display:"flow-root"}}>
              <Box component="button" type="button" onClick={()=>onOpenFullGenealogy(candidate.id)} aria-label="查看宗室谱系" sx={{p:0,border:0,background:"none",cursor:"pointer",color:"inherit",font:"inherit",textDecoration:"underline"}}>{formatRulerName(candidate)}</Box> · {formatRulerLifeAge(candidate,worldMonth,false,team.status!=="EXTINCT")} · {current ? formatRecordedKinship(candidate, current, rulers) : "关系未记录"}
            </Typography>;
          })}
        </Box>
      ) : null}
      <RoyalMilitaryRoster key={team.name} factionId={team.name} rulers={rulers} month={worldMonth} onGenealogy={onOpenFullGenealogy}/>
      <Typography fontWeight="bold" fontSize="0.9rem">历代君主</Typography>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {orderedRulers.map((ruler, index) => {
          const current = ruler.id === currentRulerId;
          const expanded = ruler.id === selectedRulerId;
          return (
            <PersonArchiveCard key={ruler.id} index={index} active={current} expanded={expanded}
              focusRequest={expanded} onSelect={()=>onSelectedRulerIdChange(expanded?undefined:ruler.id)} portrait={<PortraitSummary portrait={{personId:ruler.militaryIdentity?.personId??ruler.residentIdentity?.personId??ruler.id,age:rulerPortraitAge(ruler,worldMonth,team.status!=="EXTINCT"),...royalPortraitContext(ruler,team,worldMonth)}} name={formatRulerRowName(ruler,team)} lines={[`${getFactionDisplayNameAtMonth(team,royalPortraitContext(ruler,team,worldMonth).month)} · ${{LEADER:"首领",KING:"国王",EMPEROR:"皇帝",UNKNOWN:"身份未载",XIAOWEI:"校尉",PIJIANG:"裨将",JIANGJUN:"将军",SHANGJIANGJUN:"上将军"}[royalPortraitContext(ruler,team,worldMonth).role]}`,formatRulerListSubtitle(ruler,worldMonth,factionStatus,events,team.name),formatRulerLifeAge(ruler,worldMonth,false,team.status!=="EXTINCT"),...getPosthumousLabelLines(ruler,team,ruler.endYear??worldMonth),`${formatWorldDate(ruler.accessionYear??0)}—${ruler.endYear===undefined?"今":formatWorldDate(ruler.endYear)}`,ruler.residentIdentity?`于${ruler.residentIdentity.cityName}起事`:""]} onFull={()=>onSelectedRulerIdChange(ruler.id)}/>}
              heading={<>
                <Typography
                  fontWeight={ruler.templeName ? "bold" : current || ruler.posthumousEpithet ? 600 : "normal"}
                  fontSize="0.92rem" sx={{display:"flow-root"}}
                >
                  {current ? "● " : ""}
                  {formatRulerRowName(ruler, team)} <Box component="span" sx={{display:"block",fontSize:"0.76rem",fontWeight:400,color:"var(--gg-text-muted)"}}>{formatRulerLifeAge(ruler,worldMonth,false,team.status!=="EXTINCT")}</Box>{ruler.relationType === "USURPER" ? "【篡朝】" : ""}
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
              </>}>
              {expanded ? (
                <Box sx={{ mt: 0.65 }}>
                  <Button size="small" onClick={()=>onOpenFullGenealogy(ruler.id)}>查看宗谱</Button>
                  <RulerBiography ruler={ruler as FormalRuler} rulers={rulers} worldMonth={worldMonth} team={team} events={events} factionById={factionById} />
                </Box>
              ) : null}
            </PersonArchiveCard>
          );
        })}
      </Box>
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
  const evidence=deriveRulerAssessment({ruler,dynasty:{rulers},faction:team,events,worldMonth}).evidence;
  const bio=composeRulerBiography(evidence,formatRulerName(ruler),ruler.accessionYear);
  const fullMilestoneEvents=getRulerHistoricalEvents(events,ruler,team.name,worldMonth,ruler.chronicle.notableEventIds,Number.POSITIVE_INFINITY);
  const milestoneEvents=getRulerHistoricalEvents(events,ruler,team.name,worldMonth,ruler.chronicle.notableEventIds,8);
  const diplomaticEvents=getRulerDiplomaticEvents(events,ruler,team.name,worldMonth);
  const start=ruler.chronicle.accessionSnapshot,end=ruler.chronicle.endSnapshot??ruler.chronicle.latestSnapshot??start;
  const parent=rulers.find(p=>p.id===ruler.parentId),predecessor=rulers.find(p=>p.id===ruler.predecessorId);
  const title=hasRecordedRulerDeath(ruler)&&ruler.endYear!==undefined&&(ruler.templeName||ruler.posthumousEpithet)?formatPosthumousRulerName(ruler,team,ruler.endYear):formatRulerName(ruler);
  const posthumousLines=hasRecordedRulerDeath(ruler)?getPosthumousLabelLines(ruler,team,ruler.endYear??worldMonth):[];
  const textFor=(event:WorldEvent)=>(formatRulerMilitaryEvent(event,ruler,team.name,worldMonth,{factions:factionById,people:MilitaryCommandRegistry.getPeople(),events})??formatRulerTerminalEvent(event,ruler,team.name,factionById)??formatRulerDiplomacyEvent(event,factionById,ruler.id)??formatFactionHistoryEvent(event,team.name,factionById)??formatHistoryEventTitle(event,factionById)).replace(/所属编组/g,"所部");
  return <Box sx={{border:"1px solid var(--gg-border)",borderRadius:"var(--gg-radius)",p:1,background:"var(--gg-panel)"}}>
    <PersonChronicleLayout title={<><Typography fontWeight="bold">{title}</Typography><Typography fontSize="0.76rem" color="var(--gg-text-muted)">{formatRulerLifeAge(ruler,worldMonth,false,team.status!=="EXTINCT")}</Typography></>}
      identity={<ChronicleSection title="身份与王统">
        <PersonLifeDates bornMonth={ruler.bornYear} deathMonth={ruler.deathMonth}/>
        <Typography fontSize="0.82rem">{ruler.houseName} · {ruler.reignOrdinal?`第${ruler.reignOrdinal}代君主 · `:""}{formatWorldDate(ruler.accessionYear)}—{ruler.endYear===undefined?"今":formatWorldDate(ruler.endYear)}</Typography>
        <Typography fontSize="0.82rem">{predecessor&&["DIRECT_CHILD","GRANDCHILD","SIBLING","NEPHEW","UNCLE","COUSIN","COLLATERAL_KIN"].includes(ruler.relationType??"")?formatRecordedSuccessionKinship(ruler,predecessor,rulers):formatRulerRelation(ruler.relationType,team.identityStage,Boolean(parent),Boolean(ruler.chronicle.foundedStateName))}</Typography>
        <Typography fontSize="0.82rem">世系：{formatRulerLineage(ruler.relationType,parent?formatRulerRowName(parent,team):undefined,team.identityStage,Boolean(ruler.chronicle.foundedStateName))}</Typography>
      </ChronicleSection>}
      preBiography={<RulerServicePanel ruler={ruler} factionId={team.name} month={worldMonth}/> }
      biographyTitle="生平本纪" biography={ruler.residentIdentity?[`${formatWorldDate(ruler.residentIdentity.foundedMonth)}，${ruler.residentIdentity.military?`原任${ruler.residentIdentity.sourceFactionName}${MILITARY_OFFICE_NAMES[ruler.residentIdentity.military.office as keyof typeof MILITARY_OFFICE_NAMES]??"将领"}，率${ruler.residentIdentity.military.participants.length-1}名旧部`:`原为${ruler.residentIdentity.sourceFactionName}居民` }，于${ruler.residentIdentity.cityName}参与起事，脱离原政权并成为新势力首领。`,...bio.life]:bio.life} milestoneTitle="重大纪年" milestoneTotal={fullMilestoneEvents.length} personKey={ruler.id}
      allMilestones={()=>fullMilestoneEvents.map(event=>({id:event.id,content:<Typography fontSize="0.82rem">{formatWorldDate(event.monthIndex??event.year)} · {textFor(event)}</Typography>}))}
      milestones={milestoneEvents.map(event=>({id:event.id,content:<>
        <Typography fontSize="0.82rem">{formatWorldDate(event.monthIndex??event.year)} · {textFor(event)}</Typography>

      </>}))}
      governance={<ChronicleSection title="治世与国势">
        <Typography fontSize="0.82rem">领土：{formatReignTerritoryChange(start.territoryShare,end.territoryShare)}</Typography>
        <Typography fontSize="0.82rem">疆域曾达{(evidence.peakTerritory*100).toFixed(1)}% · 城市{start.cityCount}→{end.cityCount}座</Typography>
        <Typography fontSize="0.82rem">人口{start.population}→{end.population} · 稳定{start.stability}→{end.stability}</Typography>
        <Typography fontSize="0.82rem">城邑失守{evidence.citiesLost}次。</Typography>
        <Typography fontSize="0.82rem">本人参战取城{bio.stats.personalCityCaptures}次；治下军队取城{bio.stats.nationalCityCaptures}次、攻取敌都{bio.stats.nationalCapitalCaptures}次。</Typography>
      </ChronicleSection>}
      assessment={bio.assessment} voice={bio.voice}
      evidence={<>
        {fullMilestoneEvents.filter(e=>e.type==="ruler-deposed").map(e=><DepositionSelectionDetails key={e.id} event={e}/>)}
        <Typography fontSize="0.78rem">即位年龄{Math.floor(monthsToYears(ruler.accessionYear-ruler.bornYear))}岁；{formatRulerLifeAge(ruler,worldMonth,false,team.status!=="EXTINCT")}</Typography>
        {posthumousLines.map(line=><Typography key={line} fontSize="0.78rem">{line}</Typography>)}
        {ruler.residentIdentity&&<Typography fontSize="0.78rem">居民身份：{ruler.residentIdentity.personId}；原User {ruler.residentIdentity.sourceUserId} / {ruler.residentIdentity.sourceUserLabel}；出生{formatWorldDate(ruler.residentIdentity.bornMonth)}</Typography>}
        <Typography fontSize="0.78rem">继位背景：{getSuccessionBackground(ruler,rulers)}</Typography>
        <Typography fontSize="0.78rem">原始任期累计（未改写）：内乱{ruler.chronicle.rebellionsDuringReign}次、复国{ruler.chronicle.restorationsDuringReign}次</Typography>
        <Typography fontSize="0.78rem">旧累计亲征夺城{ruler.chronicle.citiesCapturedPersonally}次；当前保留事件核验本人行动夺城{bio.stats.personalCityCaptures}次（含收复）。前者为已保存累计值，后者要求在任月份、本国进攻方、本人行动与事件分组证据；资料缺口时不强行改成同数。</Typography>
        <Typography fontSize="0.78rem">{getReignTrajectoryPresentation(evidence.trajectory,evidence.isFinalized)}；峰值为留存观察，不代表本人亲自组织征服。</Typography>
        <HistoricalEventArchive title="完整外交档案" entries={diplomaticEvents.map(event=>({id:event.id,content:<>
          <Typography fontSize="0.82rem">{formatWorldDate(event.monthIndex??event.year)} · {formatRulerDiplomacyEvent(event,factionById,ruler.id)??formatHistoryEventTitle(event,factionById)}</Typography>
          {getDiplomacyEventDetails(event,factionById).map(line=><Typography key={line} fontSize="0.78rem">{line}</Typography>)}
          <HistoricalEvidence eventId={event.id} source={event.type}/>
        </>}))}/>
        <HistoricalEventArchive title="任期国家原始事件（不全属个人事迹）" entries={events.filter(event=>{
          const month=event.monthIndex??event.year;
          return month>=ruler.accessionYear&&month<=Math.min(ruler.endYear??worldMonth,worldMonth)&&
            (event.actorFactionId===team.name||event.targetFactionId===team.name||event.factionIds?.includes(team.name));
        }).map(event=>({id:event.id,content:<>
          <Typography fontSize="0.78rem">{formatWorldDate(event.monthIndex??event.year)} · {textFor(event)}</Typography>
          <HistoricalEvidence eventId={event.id} source={event.type}/>
        </>}))}/>
      </>}
    />
  </Box>;
}

type FormalRuler = Ruler & {
  accessionYear: number;
  chronicle: NonNullable<Ruler["chronicle"]>;
  reignOrdinal: number;
};

function isFormalRuler(ruler: Ruler): ruler is FormalRuler {
  return isFormalRulerRecord(ruler);
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
  if (status === "abdicated") return "退位";
  if (status === "deposed") return "被废";
  if (status === "politically-ended") return "政治任期已终 · 生死未载";
  return "君主";
}

function formatRulerRowName(
  ruler: Ruler,
  team: RootState["root"]["teams"][number]
) {
  if (hasRecordedRulerDeath(ruler) && ruler.endYear !== undefined && (ruler.templeName || ruler.posthumousEpithet)) {
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
  return terminationReason === "SUBMITTED" ? "【纳土归附】已纳土" : terminationReason === "MERGED" ? "【同源合邦】已并入" : "【覆灭】已覆灭";
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
