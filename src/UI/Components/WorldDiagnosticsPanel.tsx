import { Alert, Box, Button, Snackbar, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import Game from "../../Game/Game";
import { getFactionStability } from "../../Components/City";
import WorldEra, { classifyEra } from "../../Simulation/WorldEra";
import LongRunProfiler from "../../Simulation/LongRunProfiler";
import { calculateTerritoryMetrics, getFactionTerritoryMetric } from "../../Simulation/TerritoryMetrics";
import { formatWorldDate, formatWorldDuration } from "../../Simulation/WorldTime";
import { RootState } from "../../store";
import { exportWorldSave } from "../../Persistence/WorldSaveExporter";
import { hydrateWorldSave, HydrationReport } from "../../Persistence/WorldSaveHydrator";
import { validateWorldSave } from "../../Persistence/WorldSaveValidator";
import { diffCanonicalWorldSave, type CanonicalWorldSaveDiff, type WorldSaveV1 } from "../../Persistence/WorldSaveSchema";
import { APP_VERSION } from "../../config/version";
import packageJson from "../../../package.json";
import { DesktopDiagnostics, isDesktopContinuousRuntime } from "../../Runtime/DesktopRuntime";
import { getNameGenerationSummary } from "../../Politics/NameGenerationTelemetry";
import { getCityNamingSummary } from "../../Simulation/CityNamingTelemetry";
import DynastyRegistry from "../../Politics/Dynasty";
import { summarizeProvisionalRulers } from "../../Politics/ProvisionalRulerDiagnostics";
import { getEraAtlasDiagnostics } from "../../Simulation/EraMapSnapshot";
import { BASE_PLAY_RATE } from "../../Simulation/SimulationDriver";
import worldRandom, { WORLD_RNG_ALGORITHM } from "../../Simulation/WorldRandom";
import { getAvatarRendererMode } from "../../Runtime/AvatarRendererMode";
import { formatCoreDiagnostics, formatFullDiagnostics, stableStringify } from "../../Runtime/DiagnosticsReport";
import DiagnosticsPanelBoundary from "./DiagnosticsPanelBoundary";
import { createDiagnosticCopyAction } from "../../Runtime/DiagnosticCopyAction";
import { readDesktopSuspendPolicy } from "../../Runtime/DesktopSuspendPolicy";
import {
  getWorldSaveStorageDiagnostics,
  subscribeWorldSaveStorageDiagnostics,
  WorldSaveStorageDiagnostics,
} from "../../Persistence/WorldSaveDiagnostics";
import {
  getGenealogyViewerDiagnostics,
  subscribeGenealogyViewerDiagnostics,
} from "./FactionDetails/GenealogyViewerDiagnostics";

let debugMemorySnapshot: WorldSaveV1 | undefined;

const thresholds = [
  ["整合领袖", "22% 领土，稳定度 60，领先 3 或 1.1 倍"],
  ["霸权动量", "32% 领土，稳定度 60，领先 5"],
  ["霸权时代", "35% 领土，第二强国低于 22% 或达到两倍"],
  ["称帝", "60% 领土，55% 城市，稳定度 65，明显领先"],
  ["王朝时代", "皇帝、60% 领土、55% 城市、明显领先"],
  ["一统", "只剩一个正式政权"],
];

function debugEnabled() {
  return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
}

export default function WorldDiagnosticsPanel() {
  return <DiagnosticsPanelBoundary><WorldDiagnosticsPanelContent /></DiagnosticsPanelBoundary>;
}

function WorldDiagnosticsPanelContent() {
  const teams = useSelector((state: RootState) => state.root.teams);
  const worldMonth = useSelector((state: RootState) => state.root.worldMonth);
  const worldPhase = useSelector((state: RootState) => state.root.worldPhase);
  const simulationSpeed = useSelector((state: RootState) => state.root.simulationSpeed);
  const diagnosticsEnabled = debugEnabled();
  const diagnosticsMonth = Math.floor(worldMonth / 12) * 12;
  const [, setTick] = useState(0);
  const [hydrationBusy, setHydrationBusy] = useState(false);
  const [hydrationStatus, setHydrationStatus] = useState("");
  const [canonicalDiff, setCanonicalDiff] = useState<CanonicalWorldSaveDiff>();
  const [storageDiagnostics, setStorageDiagnostics] = useState<WorldSaveStorageDiagnostics>(getWorldSaveStorageDiagnostics);
  const [genealogyViewer, setGenealogyViewer] = useState(getGenealogyViewerDiagnostics);
  const [desktopDiagnostics, setDesktopDiagnostics] = useState<DesktopDiagnostics>();
  const [copyFeedback, setCopyFeedback] = useState("");
  useEffect(() => {
    if (!diagnosticsEnabled) return undefined;
    const timer = window.setInterval(() => setTick((value) => value + 1), 500);
    return () => window.clearInterval(timer);
  }, [diagnosticsEnabled]);
  useEffect(() => {
    const unsubscribe = subscribeWorldSaveStorageDiagnostics(setStorageDiagnostics);
    return () => { unsubscribe(); };
  }, []);
  useEffect(() => subscribeGenealogyViewerDiagnostics(setGenealogyViewer), []);
  useEffect(() => {
    if (!diagnosticsEnabled) return undefined;
    const bridge = window.gridGodDesktop;
    if (!bridge?.getDiagnostics) return;
    let active = true;
    const refresh = () => {
      void bridge.getDiagnostics?.().then((value) => { if (active) setDesktopDiagnostics(value); }).catch((error) => { console.error("Diagnostics refresh failed", error); });
    };
    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [diagnosticsEnabled]);

  const provisionalRulers = useMemo(() => {
    if (!diagnosticsEnabled) return undefined;
    const factions = new Map(teams.map((team) => [team.name, {
      displayName: team.displayName, identityStage: team.identityStage,
      status: team.status, sovereigntyHistory: team.sovereigntyHistory,
    }]));
    const dynasties = DynastyRegistry.listForDiagnostics();
    return {
      ...summarizeProvisionalRulers(dynasties, factions),
      session: DynastyRegistry.getProvisionalSessionDiagnostics(factions),
      recent: summarizeProvisionalRulers(dynasties, factions, { completedSinceMonth: Math.max(0, worldMonth - 1200) }),
    };
  }, [diagnosticsEnabled, teams, Math.floor(worldMonth / 12)]);

  const diagnostics = useMemo(() => {
    if (!diagnosticsEnabled) return undefined;
    const totalCells = Game.Core?.totalCells ?? 1;
    const territory = calculateTerritoryMetrics(teams, totalCells);
    const ranked = teams
      .filter((team) => team.status === "ACTIVE")
      .map((team) => ({
        team,
        metric: getFactionTerritoryMetric(territory, team.name),
        stability: getFactionStability(team) ?? 0,
      }))
      .sort((a, b) => b.metric.controlledTerritoryShare - a.metric.controlledTerritoryShare)
      .slice(0, 3);
    const currentEra = WorldEra.getCurrentEra();
    const candidate = WorldEra.getCandidateDiagnostics(diagnosticsMonth);
    const validity = WorldEra.getCurrentEraValidityDiagnostics(diagnosticsMonth);
    const liveClassification = classifyEra(
      teams,
      totalCells,
      diagnosticsMonth,
      worldPhase,
      currentEra
    );
    const cycle = Game.Core?.simulator?.getWorldCycleDiagnostics();
    const longRun = LongRunProfiler.getSummary(diagnosticsMonth, WorldEra.getEras(), cycle?.stage);
    const naming = getNameGenerationSummary();
    const cityNaming = getCityNamingSummary();
    const eraAtlas = getEraAtlasDiagnostics(WorldEra.getEras());
    return { ranked, currentEra, candidate, validity, liveClassification, cycle, longRun, naming, cityNaming, eraAtlas };
  }, [diagnosticsEnabled, teams, diagnosticsMonth, worldPhase]);

  if (!diagnosticsEnabled || !diagnostics || !provisionalRulers) {
    return null;
  }

  const core = Game.Core;
  const determinism = core?.getDeterminismDiagnostics();
  const snapshotRequest = core?.getSnapshotRequestDiagnostics();
  const desktopRuntime = core?.getRuntimeLivenessDiagnostics();
  const runtimeUnits = core?.getRuntimeUnitDiagnostics();
  const worldScale = core?.getWorldScaleDiagnostics();
  const stepPerformance = core?.getStepPerformanceDiagnostics() ?? {};
  const unionCandidateDiagnostics = core?.getStrategicUnionCandidateDiagnostics() ?? [];
  const desktopAutosave = desktopDiagnostics?.lastAutosaveResult;
  const summary = [
    `世界年月：${formatWorldDate(worldMonth)}（${worldMonth}月）`,
    `Determinism：seed=${determinism?.seed ?? worldRandom.exportState().seed}｜RNG=${determinism?.rngAlgorithm ?? WORLD_RNG_ALGORITHM}｜draws=${determinism?.rngPosition ?? worldRandom.exportState().position}`,
    `Determinism checkpoints：${determinism?.checkpoints.map((entry) => `${formatWorldDate(entry.worldMonth)} | digest=${entry.digest} | rng draws=${entry.rngPosition}`).join("；") || "尚无10年检查点"}`,
    `Playback：base ${BASE_PLAY_RATE.toFixed(1)}｜selected ${simulationSpeed}×｜effective ${(BASE_PLAY_RATE * simulationSpeed).toFixed(1)}×`,
    `当前时代：${diagnostics.currentEra ? `${diagnostics.currentEra.type} · ${diagnostics.currentEra.name} · ${formatWorldDate(diagnostics.currentEra.startMonth)}起` : "暂无已确认时代"}`,
    `Era Atlas：snapshots ${diagnostics.eraAtlas.snapshotCount}｜raw cells ${diagnostics.eraAtlas.rawCells}｜RLE runs ${diagnostics.eraAtlas.rleRuns}｜estimated JSON bytes ${diagnostics.eraAtlas.estimatedJsonBytes}`,
    `当前格局：${diagnostics.liveClassification?.type ?? "—"} · ${diagnostics.liveClassification?.name ?? (diagnostics.validity.isStale ? "格局转换中" : "天下未定")}`,
    `旧时代退出：${diagnostics.validity.isStale ? `已失效${formatWorldDuration(diagnostics.validity.staleMonths)} / ${formatWorldDuration(diagnostics.validity.graceMonths)}` : "当前仍有效"}`,
    `时代候选：${diagnostics.candidate ? `${diagnostics.candidate.type} · ${diagnostics.candidate.name} · ${formatWorldDate(diagnostics.candidate.sinceMonth)}起 · 已持续${formatWorldDuration(diagnostics.candidate.sustainedMonths)} / ${formatWorldDuration(diagnostics.candidate.requiredMonths)}` : "当前无新时代候选，现时代保持中"}`,
    ...diagnostics.ranked.map(({ team, metric, stability }, index) => `${index + 1}. ${team.displayName}｜${team.status}｜${team.identityStage}｜${team.sovereigntyRank}｜诸国领土${metric.controlledTerritoryShare.toFixed(1)}%｜世界绝对领土${metric.absoluteWorldShare.toFixed(1)}%｜城市${team.cities.length}｜稳定${stability}`),
    `周期：${diagnostics.cycle?.stage ?? "—"}｜分裂年龄${diagnostics.cycle?.fragmentationAge ?? 0}月｜统一年龄${diagnostics.cycle?.unifiedAge ?? 0}月｜整合修正${(diagnostics.cycle?.consolidationModifier ?? 0).toFixed(2)}｜后期分裂压力${(diagnostics.cycle?.lateFragmentationPressure ?? 0).toFixed(2)}｜记忆底线${(diagnostics.cycle?.consolidationMemoryFloor ?? 0).toFixed(2)}`,
    `整合候选：${diagnostics.cycle?.consolidationLeaderCandidateId ?? "—"}｜整合动量持有者：${diagnostics.cycle?.consolidationLeaderOwnerId ?? "—"} · ${(diagnostics.cycle?.consolidationLeaderMomentum ?? 0).toFixed(2)}｜霸权候选：${diagnostics.cycle?.hegemonicCandidateId ?? "—"}｜霸权动量持有者：${diagnostics.cycle?.hegemonicOwnerId ?? "—"} · ${(diagnostics.cycle?.hegemonicMomentum ?? 0).toFixed(2)}｜围城倍率${(diagnostics.cycle?.hegemonicSiegeMultiplier ?? 1).toFixed(3)}`,
    `王朝秩序：${diagnostics.cycle?.dynasticOrderFactionId ?? "—"}`,
    `World Cycle Summary：统一${diagnostics.longRun.unificationCount}次｜分裂${diagnostics.longRun.fragmentationCount}次｜历史章节${diagnostics.longRun.eraCount}｜时代平均${diagnostics.longRun.averageEraDuration === undefined ? "—" : formatWorldDuration(diagnostics.longRun.averageEraDuration)}｜最短${diagnostics.longRun.shortestEraDuration === undefined ? "—" : formatWorldDuration(diagnostics.longRun.shortestEraDuration)}｜最长${diagnostics.longRun.longestEraDuration === undefined ? "—" : formatWorldDuration(diagnostics.longRun.longestEraDuration)}｜空档${diagnostics.longRun.eraGapMonths}月｜每百年换代${diagnostics.longRun.eraTransitionsPerCentury?.toFixed(1) ?? "—"}`,
    `完整周期：合${diagnostics.longRun.completedUnifiedEpisodes}次（${diagnostics.longRun.averageUnifiedDuration === undefined ? "—" : formatWorldDuration(diagnostics.longRun.averageUnifiedDuration)} / 中位${diagnostics.longRun.medianUnifiedDuration === undefined ? "—" : formatWorldDuration(diagnostics.longRun.medianUnifiedDuration)}）｜分${diagnostics.longRun.completedFragmentedEpisodes}次（${diagnostics.longRun.averageFragmentedDuration === undefined ? "—" : formatWorldDuration(diagnostics.longRun.averageFragmentedDuration)} / 中位${diagnostics.longRun.medianFragmentedDuration === undefined ? "—" : formatWorldDuration(diagnostics.longRun.medianFragmentedDuration)}）｜当前${diagnostics.longRun.currentCycleStage ?? "—"}`,
    `Consolidation Bottleneck：正式头部峰值${diagnostics.longRun.bottleneck.maxFormalTop1TerritoryShare.toFixed(1)}%｜>40% ${diagnostics.longRun.bottleneck.monthsFormalTop1Above40}月｜>50% ${diagnostics.longRun.bottleneck.monthsFormalTop1Above50}月｜候选段${diagnostics.longRun.bottleneck.hegemonicCandidateEpisodes}｜持有者换手${diagnostics.longRun.bottleneck.hegemonicOwnerChanges}｜最大动量${diagnostics.longRun.bottleneck.maxHegemonicMomentum.toFixed(2)}`,
    `Dynastic blockers：${Object.entries(diagnostics.longRun.bottleneck.dynasticOrderBlockerMonths).map(([key, value]) => `${key} ${value}月`).join("｜") || "—"}`,
    `Dynastic continuity：领土合格${diagnostics.longRun.bottleneck.monthsTerritoryQualified60}月｜城市合格${diagnostics.longRun.bottleneck.monthsCityQualified55}月｜稳定合格${diagnostics.longRun.bottleneck.monthsStabilityQualified65}月｜Top2合格${diagnostics.longRun.bottleneck.monthsTop2Qualified20}月｜全部合格${diagnostics.longRun.bottleneck.monthsAllDynasticConditionsQualified}月｜最长连续领土${diagnostics.longRun.bottleneck.maxConsecutiveTerritory60}月｜最长全合格${diagnostics.longRun.bottleneck.maxConsecutiveAllQualified}月｜候选段${diagnostics.longRun.bottleneck.dynasticCandidateEpisodeCount}`,
    `Sole blocker：${Object.entries(diagnostics.longRun.bottleneck.soleBlockerMonths).map(([key, value]) => `${key} ${value}月`).join("｜") || "—"}`,
    `Provisional Bottleneck：头部${diagnostics.longRun.bottleneck.top1ProvisionalMonths}月｜前三${diagnostics.longRun.bottleneck.top3ContainsProvisionalMonths}月｜最大领土${diagnostics.longRun.bottleneck.maxProvisionalTerritoryShare.toFixed(1)}%｜最大城市${diagnostics.longRun.bottleneck.maxProvisionalCityCount}`,
    `Top Empire Stability：当前${diagnostics.longRun.bottleneck.currentTop1Stability?.toFixed(1) ?? "—"}｜>40%最低${diagnostics.longRun.bottleneck.minimumStabilityWhileAbove40?.toFixed(1) ?? "—"}｜>50%最低${diagnostics.longRun.bottleneck.minimumStabilityWhileAbove50?.toFixed(1) ?? "—"}｜>50%且<65 ${diagnostics.longRun.bottleneck.monthsAbove50ButStabilityBelow65}月｜raw/effective strain ${diagnostics.longRun.bottleneck.rawImperialStrain?.toFixed(1) ?? "—"}/${diagnostics.longRun.bottleneck.effectiveImperialStrain?.toFixed(1) ?? "—"}`,
    `Literal Monopoly：${diagnostics.longRun.literalUnificationCount}次｜已完成${diagnostics.longRun.literalMonopolyEpisodes}段｜平均${diagnostics.longRun.averageLiteralMonopolyDuration === undefined ? "—" : formatWorldDuration(diagnostics.longRun.averageLiteralMonopolyDuration)}｜当前${diagnostics.longRun.currentLiteralMonopolyAge === undefined ? "—" : formatWorldDuration(diagnostics.longRun.currentLiteralMonopolyAge)}`,
    `Dynastic Order：建立${diagnostics.longRun.dynasticOrderEstablishedCount}次｜瓦解${diagnostics.longRun.dynasticOrderLostCount}次｜完成${diagnostics.longRun.completedDynasticOrderEpisodes}段｜平均${diagnostics.longRun.averageDynasticOrderDuration === undefined ? "—" : formatWorldDuration(diagnostics.longRun.averageDynasticOrderDuration)}｜当前${diagnostics.longRun.currentDynasticOrderAge === undefined ? "—" : formatWorldDuration(diagnostics.longRun.currentDynasticOrderAge)}`,
    `World scale（60月采样）：${stableStringify(worldScale ?? {})}`,
    `Monthly step timing（debug rolling）：${Object.entries(stepPerformance).map(([name, metric]) => `${name} avg ${metric.averageMs.toFixed(3)}ms / p95 ${metric.p95Ms.toFixed(3)}ms / max ${metric.maxMs.toFixed(3)}ms (n=${metric.sampleCount})`).join("；") || "等待样本"}`,
    `Strategic Union candidates（最多5组）：${unionCandidateDiagnostics.map((entry) => `${entry.factionAId}/${entry.factionBId}: sameOrigin=${entry.sameOrigin}, alliance=${entry.allianceMonths}m, adjacent=${entry.adjacent}, warFree=${entry.bilateralWarFreeMonths}m, territoryRatio=${entry.territoryRatio.toFixed(2)}, cityRatio=${entry.cityRatio.toFixed(2)}, weakerStability=${entry.weakerStability.toFixed(1)}, commonThreat=${entry.commonThreatStillRelevant}, blockers=${entry.blockers.join("+") || "ELIGIBLE"}`).join(" | ") || "暂无 active alliance candidates"}`,
  ].join("\n");
  const snapshotAndReload = async () => {
    const core = Game.Core;
    if (!core || hydrationBusy) return;
    setHydrationBusy(true);
    setHydrationStatus("等待下一个完整月份与固定步长边界…");
    try {
      await core.pauseAtNextSafeSnapshotBoundary();
      const exported = exportWorldSave(core);
      debugMemorySnapshot = JSON.parse(JSON.stringify(exported)) as WorldSaveV1;
      const validation = validateWorldSave(debugMemorySnapshot);
      if (!validation.valid) throw new Error(validation.errors.join("; "));
      const report: HydrationReport = hydrateWorldSave(core, debugMemorySnapshot);
      const afterHydration = exportWorldSave(core);
      const diff = diffCanonicalWorldSave(debugMemorySnapshot, afterHydration);
      setCanonicalDiff(diff);
      setHydrationStatus([
        "Hydration OK",
        `saved month: ${debugMemorySnapshot.world.worldMonth}`,
        `hydrated month: ${report.worldMonth}`,
        `factions: ${report.factionCount}`,
        `cities: ${report.cityCount}`,
        `units: ${report.unitCount}`,
        `history events: ${report.historyEventCount}`,
        `validator: ${report.validatorResult}`,
        `canonical round-trip: ${diff.matched ? "matched" : `DIFF (${diff.differenceCount})`}`,
      ].join("｜"));
    } catch (error) {
      setHydrationStatus(`Hydration failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setHydrationBusy(false);
    }
  };

  const runtime = desktopRuntime;
  const populationTransitions = core?.getPopulationTransitionAudit() ?? [];
  const framePerformance = runtime?.framePerformance;
  const hydration = core?.getHydrationDiagnostics();
  const snapshotState = snapshotRequest?.requestState;
  const subsystemSummary = canonicalDiff
    ? Object.entries(canonicalDiff.subsystemCounts).map(([key, count]) => `${key}: ${count}`).join("\n")
    : "暂无 canonical comparison";
  const pathDiffSummary = canonicalDiff?.differences.length
    ? canonicalDiff.differences.map((entry) => `${entry.path}\n  before: ${stableStringify(entry.before)}\n  after: ${stableStringify(entry.after)}`).join("\n")
    : "无 path-level 差异";
  const desktopHeartbeat = desktopDiagnostics?.latestHeartbeat;
  const colliderDiagnostics = core?.getColliderTeardownDiagnostics();
  const buildCoreReportData = () => ({
    appVersion: APP_VERSION,
    packageVersion: packageJson.version,
    timestamp: new Date().toISOString(),
    runtime: {
      worldSeed: worldRandom.exportState().seed,
      worldRngAlgorithm: WORLD_RNG_ALGORITHM,
      worldRngPosition: worldRandom.exportState().position,
      determinismCheckpoints: determinism?.checkpoints,
      genealogyViewer,
      mapPointer: runtime?.mapPointer,
      mode: runtime?.runtimeMode ?? (isDesktopContinuousRuntime() ? "DESKTOP_CONTINUOUS" : "WEB_CATCH_UP"),
      platform: desktopDiagnostics?.platform ?? window.gridGodDesktop?.platform,
      electronVersion: window.gridGodDesktop?.electronVersion,
      worldMonth: runtime?.worldMonth ?? worldMonth,
      running: runtime?.simulatorRunning ?? desktopHeartbeat?.running,
      speed: desktopHeartbeat?.selectedSpeed ?? simulationSpeed,
      worldInstanceId: runtime?.worldInstanceId ?? desktopHeartbeat?.worldInstanceId,
      fixedSteps: runtime?.fixedSimulationSteps ?? desktopHeartbeat?.fixedSteps,
      physicsSteps: runtime?.physicsSteps ?? desktopHeartbeat?.physicsSteps,
      backgroundMode: runtime?.backgroundMode ?? desktopHeartbeat?.backgroundMode,
      catchUpDebt: runtime?.catchUpDebtSteps ?? desktopHeartbeat?.catchUpDebtSteps,
      activeCatchUpSource: runtime?.catchUpSource ?? desktopHeartbeat?.catchUpSource,
      lastCatchUpSource: runtime?.lastCatchUpSource ?? desktopHeartbeat?.lastCatchUpSource,
      focused: desktopDiagnostics?.focused ?? desktopHeartbeat?.focused,
      visibility: desktopDiagnostics?.visibility ?? desktopHeartbeat?.documentVisibilityState,
      windowMinimized: desktopDiagnostics?.windowMinimized,
      minimizeCount: desktopDiagnostics?.minimizeCount,
      suspendCount: desktopDiagnostics?.suspendCount,
      lastSuspendDuration: desktopDiagnostics?.lastSuspendDurationMs,
      resumeCatchUp: desktopDiagnostics?.resumeCatchUp,
      suspendPolicy: isDesktopContinuousRuntime() ? readDesktopSuspendPolicy() : undefined,
      coreFrameCount: framePerformance?.renderFrameCount,
    },
    units: runtimeUnits ? {
      ...runtimeUnits,
      avatarRenderer: getAvatarRendererMode(),
    } : undefined,
    populationTransitions,
    provisionalRulers,
    simulationStepPerformance: stepPerformance,
    strategicUnionCandidates: unionCandidateDiagnostics,
    performance: framePerformance ? {
      fps: framePerformance.frameDeltaMs.average && framePerformance.frameDeltaMs.average > 0 ? 1000 / framePerformance.frameDeltaMs.average : undefined,
      averageFrameMs: framePerformance.frameDeltaMs.average,
      p95FrameMs: framePerformance.frameDeltaMs.p95,
      maxFrameMs: framePerformance.frameDeltaMs.max,
      longFrames: framePerformance.longFrames,
      stepsPerFrame: framePerformance.simulationStepsPerFrame,
      fixedStepCpuMs: framePerformance.fixedStepCpuMs,
      presentationCpuMs: framePerformance.presentationCpuMs,
      renderFrameCount: framePerformance.renderFrameCount,
      sampleCount: framePerformance.sampleCount,
    } : undefined,
    worldScale,
    persistence: {
      saveStatus: storageDiagnostics.status,
      savedAt: storageDiagnostics.savedAt,
      saveMonth: storageDiagnostics.worldMonth,
      serializedBytes: storageDiagnostics.serializedBytes ?? desktopDiagnostics?.lastAutosaveResult?.serializedBytes,
      writeDurationMs: storageDiagnostics.writeDurationMs ?? desktopDiagnostics?.lastAutosaveResult?.writeDurationMs,
      storage: storageDiagnostics,
      desktopAutosave: desktopDiagnostics?.lastAutosaveResult,
      totalSaveDurationMs: storageDiagnostics.totalSaveDurationMs ?? desktopDiagnostics?.lastAutosaveResult?.totalSaveDurationMs,
      waitSafeBoundaryMs: storageDiagnostics.waitSafeBoundaryMs ?? desktopDiagnostics?.lastAutosaveResult?.waitSafeBoundaryMs,
      exportSerializeMs: storageDiagnostics.exportSerializeMs ?? desktopDiagnostics?.lastAutosaveResult?.exportSerializeMs,
      indexedDbWriteMs: storageDiagnostics.indexedDbWriteMs ?? desktopDiagnostics?.lastAutosaveResult?.indexedDbWriteMs,
    },
    hydration: {
      stage: hydration?.lastStage,
      status: hydrationStatus || undefined,
      canonicalMatched: canonicalDiff?.matched,
      canonicalDiff,
      snapshotRequest,
    },
    collider: { postDrain: colliderDiagnostics?.activeAfterPostDrain, diagnostics: colliderDiagnostics },
  });
  const buildCoreReport = () => formatCoreDiagnostics(buildCoreReportData());
  const buildHydrationReport = () => formatFullDiagnostics([[
    "Hydration diagnostics",
    {
      savedWorldMonth: storageDiagnostics.worldMonth,
      currentWorldMonth: runtime?.worldMonth ?? worldMonth,
      lastHydrationStatus: hydrationStatus || undefined,
      lastHydrationStage: hydration?.lastStage,
      snapshotRequest,
      canonicalDiff,
      colliderTeardown: colliderDiagnostics,
      storage: storageDiagnostics,
    },
  ]]);
  const buildFullReport = () => {
    const coreReportData = buildCoreReportData();
    const currentEraReport = diagnostics.currentEra ? {
      id: diagnostics.currentEra.id,
      type: diagnostics.currentEra.type,
      name: diagnostics.currentEra.name,
      startMonth: diagnostics.currentEra.startMonth,
      confirmedMonth: diagnostics.currentEra.confirmedMonth,
      endMonth: diagnostics.currentEra.endMonth,
      dominantFactionIds: diagnostics.currentEra.dominantFactionIds,
      mapSnapshot: diagnostics.currentEra.mapSnapshot ? {
        capturedMonth: diagnostics.currentEra.mapSnapshot.capturedMonth,
        ownerRunCount: diagnostics.currentEra.mapSnapshot.ownerRuns.length,
        cityCount: diagnostics.currentEra.mapSnapshot.cities.length,
      } : undefined,
    } : undefined;
    return formatFullDiagnostics([
      ["World posture", {
        worldMonth, worldPhase,
        ranked: diagnostics.ranked.map(({ team, metric, stability }) => ({
          factionId: team.name, displayName: team.displayName, status: team.status,
          identityStage: team.identityStage, sovereigntyRank: team.sovereigntyRank,
          territoryShare: metric.controlledTerritoryShare, absoluteWorldShare: metric.absoluteWorldShare,
          cityCount: team.cities.length, stability,
        })),
        currentEra: currentEraReport,
        candidate: diagnostics.candidate,
        validity: diagnostics.validity, liveClassification: diagnostics.liveClassification,
      }],
      ["Name generation", diagnostics.naming],
      ["City naming", diagnostics.cityNaming],
      ["Persistence", coreReportData.persistence],
      ["Hydration", { ...coreReportData.hydration, lastStage: hydration?.lastStage, collider: colliderDiagnostics }],
      ["Runtime Liveness", { runtime, simulationCounters: core?.getSimulationDiagnostics() }],
      ["Genealogy Viewer", genealogyViewer],
      ["Runtime Units", coreReportData.units],
      ["Population Transition Audit", populationTransitions],
      ["Diplomacy", core?.getDiplomacyDiagnostics()],
      ["Provisional ruler diagnostics", provisionalRulers],
      ["Frame Performance", coreReportData.performance],
      ["Simulation Step Performance", stepPerformance],
      ["Strategic Union Candidate Diagnostics", unionCandidateDiagnostics],
      ["World Scale", coreReportData.worldScale],
      ["Desktop Runtime", { diagnostics: desktopDiagnostics, runtime: desktopRuntime }],
      ["Era diagnostics", {
        currentEra: currentEraReport,
        candidate: diagnostics.candidate, validity: diagnostics.validity, atlas: diagnostics.eraAtlas,
      }],
      ["WorldCycle diagnostics", { cycle: diagnostics.cycle, longRun: diagnostics.longRun }],
    ]);
  };
  const writeClipboard = async (text: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("clipboard unavailable");
    }
  };
  const copyReport = (build: () => string, label: string) => createDiagnosticCopyAction(build, writeClipboard, setCopyFeedback, label)();
  const statusSummary = `Hydration: ${hydrationStatus.startsWith("Hydration OK") ? "OK" : hydrationStatus.startsWith("Hydration failed") ? "FAILED" : "—"}｜Canonical: ${canonicalDiff ? canonicalDiff.matched ? "matched" : `DIFF (${canonicalDiff.differenceCount})` : "—"}｜Runtime: ${runtime?.simulatorRunning ? "RUNNING" : "PAUSED"}`;

  return (
    <Box sx={{ position: "fixed", zIndex: 5000, right: 350, bottom: 8, width: 360, maxHeight: "48vh", overflowY: "auto", p: 1, bgcolor: "rgba(20,24,28,.95)", color: "#fff", border: "1px solid #90caf9", fontSize: 11 }}>
      <Typography variant="subtitle2" sx={{ color: "#90caf9" }}>世界诊断（debug=1）</Typography>
      <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9, my: 0.5 }}>{statusSummary}</Typography>
      <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{`Genealogy viewer: open=${genealogyViewer.open} lastCloseSource=${genealogyViewer.lastCloseSource ?? "—"} MUI reason=${genealogyViewer.lastMuiReason ?? "—"}`}</Typography>
      <Button size="small" variant="outlined" sx={{ color: "#90caf9", borderColor: "#90caf9" }} onClick={() => void copyReport(buildCoreReport, "核心诊断")}>复制核心诊断</Button>
      <Button size="small" variant="outlined" sx={{ ml: 0.5, color: "#a5d6a7", borderColor: "#a5d6a7" }} onClick={() => void copyReport(buildFullReport, "完整诊断")}>复制全部诊断</Button>
      <Snackbar open={Boolean(copyFeedback)} autoHideDuration={2200} onClose={() => setCopyFeedback("")}>
        <Alert severity={copyFeedback.includes("失败") ? "error" : "success"} onClose={() => setCopyFeedback("")}>{copyFeedback}</Alert>
      </Snackbar>
      <details>
        <summary>世界格局</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{summary}</Typography>
        <Typography variant="caption">关键门槛（仅解释真实规则，不改变规则）</Typography>
        {thresholds.map(([label, text]) => <Typography key={label} variant="caption" component="div">{label}：{text}</Typography>)}
      </details>
      <details>
        <summary>临时势力首领诊断</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{[
          `当前临时势力首领：${provisionalRulers.currentProvisionalRulerCount}`,
          `历史首领战死：${provisionalRulers.provisionalCombatDeathCount}`,
          `已结束任期数：${provisionalRulers.completedProvisionalRulerCount}`,
          `已结束任期中位数：${provisionalRulers.medianCompletedTenureMonths === undefined ? "—" : formatWorldDuration(provisionalRulers.medianCompletedTenureMonths)}`,
          `最异常势力（最多5）：${provisionalRulers.topAbnormalFactions.map((faction) => `${faction.factionName}: ${faction.combatDeathCount}/${faction.completedRulerCount}战死 (${(faction.combatDeathRatio * 100).toFixed(0)}%), tenure median ${formatWorldDuration(faction.medianCompletedTenureMonths)}, min/max ${formatWorldDuration(faction.shortestCompletedTenureMonths)}/${formatWorldDuration(faction.longestCompletedTenureMonths ?? 0)}`).join("；") || "—"}`,
        ].join("\n")}</Typography>
      </details>
      {[ ["本会话首领诊断（新世界/读档后完成；读档重置）", provisionalRulers.session],
         ["最近100年首领诊断（按任期结束月筛选）", provisionalRulers.recent] ].map(([label, value]) => {
        const stats = value as typeof provisionalRulers.session;
        return <details key={String(label)} open>
          <summary>{String(label)}</summary>
          <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{[
            `completed count: ${stats.completedProvisionalRulerCount}`,
            `combat death count / ratio: ${stats.provisionalCombatDeathCount} / ${stats.combatDeathRatio === undefined ? "—" : `${(stats.combatDeathRatio * 100).toFixed(1)}%`}`,
            `median tenure: ${stats.medianCompletedTenureMonths === undefined ? "—" : formatWorldDuration(stats.medianCompletedTenureMonths)}`,
            `min/max tenure: ${stats.shortestCompletedTenureMonths === undefined ? "—" : formatWorldDuration(stats.shortestCompletedTenureMonths)} / ${stats.longestCompletedTenureMonths === undefined ? "—" : formatWorldDuration(stats.longestCompletedTenureMonths)}`,
            ...stats.topAbnormalFactions.map((faction) => `${faction.factionName}: completed=${faction.completedRulerCount}, combat=${faction.combatDeathCount} (${(faction.combatDeathRatio * 100).toFixed(1)}%), median=${formatWorldDuration(faction.medianCompletedTenureMonths)}, min/max=${formatWorldDuration(faction.shortestCompletedTenureMonths)}/${formatWorldDuration(faction.longestCompletedTenureMonths ?? 0)}`),
          ].join("\n")}</Typography>
        </details>;
      })}
      <details>
        <summary>Simulation Step Performance（rolling）</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{Object.entries(stepPerformance).map(([name, metric]) =>
          `${name}: avg ${metric.averageMs.toFixed(3)}ms · p95 ${metric.p95Ms.toFixed(3)}ms · max ${metric.maxMs.toFixed(3)}ms · n=${metric.sampleCount}`
        ).join("\n") || "等待 debug step 样本"}</Typography>
      </details>
      <details>
        <summary>Strategic Union candidate blockers（最多5组）</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{unionCandidateDiagnostics.length
          ? unionCandidateDiagnostics.map((entry) => `${entry.factionAId} / ${entry.factionBId}\nsameOrigin=${entry.sameOrigin} · alliance=${entry.allianceMonths}月 · adjacent=${entry.adjacent} · bilateralWarFree=${entry.bilateralWarFreeMonths}月\nterritoryRatio=${entry.territoryRatio.toFixed(2)} · cityRatio=${entry.cityRatio.toFixed(2)} · weakerStability=${entry.weakerStability.toFixed(1)} · commonThreat=${entry.commonThreatStillRelevant}\nblockers=${entry.blockers.join(", ") || "ELIGIBLE"}`).join("\n\n")
          : "暂无 active alliance candidates"}</Typography>
      </details>
      <details>
        <summary>姓名文化统计（会话）</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{[
          `Formal state names: ${diagnostics.naming.stateNameGenerationCount}`,
          `Historical Echo: ${diagnostics.naming.historicalEchoCount} / eligible ${diagnostics.naming.echoEligibleCount}`,
          `Prestige branch: ${diagnostics.naming.prestigeBranchCount}`,
          `Echo blocked by historical use: ${diagnostics.naming.echoBlockedByHistoricalUseCount}`,
          ...Object.entries(diagnostics.naming.houses).map(([label, count]) => `${label}: ${count}`),
          `Top surnames: ${diagnostics.naming.topSurnames.map(([name, count]) => `${name}(${count})`).join("、") || "—"}`,
        ].join("\n")}</Typography>
      </details>
      <details>
        <summary>城市命名统计（会话）</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{[
          `Generated total: ${diagnostics.cityNaming.generatedTotal}`,
          ...Object.entries(diagnostics.cityNaming.categories).map(([category, count]) => `${category}: ${count}`),
          `Top suffixes: ${diagnostics.cityNaming.topSuffixes.map(([suffix, count]) => `${suffix}(${count})`).join("、") || "—"}`,
          `Recent names: ${diagnostics.cityNaming.recentNames.join("、") || "—"}`,
        ].join("\n")}</Typography>
      </details>
      <details>
        <summary>Persistence / Hydration</summary>
        <Button size="small" variant="outlined" sx={{ color: "#90caf9", borderColor: "#90caf9" }} onClick={() => void copyReport(buildHydrationReport, "Hydration 调试报告")}>复制 Hydration 调试报告</Button>
        <Button size="small" variant="outlined" disabled={hydrationBusy} sx={{ ml: 0.5, color: "#a5d6a7", borderColor: "#a5d6a7" }} onClick={snapshotAndReload}>
          {hydrationBusy ? "正在重载…" : "内存快照并重载"}
        </Button>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{`Stored save: ${storageDiagnostics.status}\nsavedAt=${storageDiagnostics.savedAt ?? "—"}｜month=${storageDiagnostics.worldMonth ?? "—"}｜schema=${storageDiagnostics.schemaVersion ?? "—"}\nlast action=${storageDiagnostics.lastAction ?? "—"}${storageDiagnostics.serializedBytes === undefined ? "" : `｜JSON bytes=${storageDiagnostics.serializedBytes}｜IDB write=${storageDiagnostics.indexedDbWriteMs?.toFixed(2) ?? storageDiagnostics.writeDurationMs?.toFixed(2)}ms｜safe wait=${storageDiagnostics.waitSafeBoundaryMs?.toFixed(2)}ms｜export/serialize=${storageDiagnostics.exportSerializeMs?.toFixed(2)}ms｜total=${storageDiagnostics.totalSaveDurationMs?.toFixed(2)}ms`}${storageDiagnostics.error ? `\n${storageDiagnostics.error}` : ""}`}</Typography>
        {snapshotRequest && <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>
          {`snapshot: ${snapshotRequest.status}｜request month ${snapshotRequest.requestMonth ?? "—"}｜reached ${snapshotRequest.boundaryReachedMonth ?? "waiting"}\nstarted while: simulator=${snapshotState?.simulatorRunning ?? "—"}, clock=${snapshotState?.clockRunning ?? "—"}, redux=${snapshotState?.reduxWorldRunning ?? "—"}, scenePaused=${snapshotState?.sceneTimePaused ?? "—"}, physicsPaused=${snapshotState?.physicsPaused ?? "—"}, accumulator=${snapshotState?.simulationAccumulatorMs ?? "—"}, elapsed=${snapshotState?.clockElapsedMs ?? "—"}\nwaiting reason: ${snapshotRequest.waitingReasons?.join(", ") || "none"}\npre-export elapsed=${snapshotRequest.preExportElapsedMs ?? "—"}, accumulator=${snapshotRequest.preExportAccumulatorMs ?? "—"}${snapshotRequest.error ? `\n${snapshotRequest.error}` : ""}`}
        </Typography>}
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{`last hydration stage: ${hydration?.lastStage ?? "—"}\n${hydrationStatus}\n${subsystemSummary}\n${pathDiffSummary}`}</Typography>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{`Collider teardown: ${stableStringify(core?.getColliderTeardownDiagnostics() ?? null)}`}</Typography>
      </details>
      <details>
        <summary>Runtime Liveness</summary>
        {runtime && <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{[
          `World seed: ${worldRandom.exportState().seed}`,
          `RNG algorithm/version: ${WORLD_RNG_ALGORITHM} · draws=${worldRandom.exportState().position}`,
          `Redux worldRunning: ${runtime.reduxWorldRunning}`,
          `Simulator running: ${runtime.simulatorRunning}`,
          `WorldClock running: ${runtime.clockRunning}`,
          `RUNNING STATE DIVERGENCE: ${runtime.runningStateDivergence}`,
          `WorldClock month / elapsed: ${runtime.worldMonth} / ${runtime.clockElapsedMs}`,
          `Scene time paused / physics paused / tweens all paused: ${runtime.sceneTimePaused} / ${runtime.physicsPaused} / ${runtime.tweensPaused ?? "no active tweens"}`,
          `active / paused tween count: ${runtime.activeTweenCount} / ${runtime.pausedTweenCount}`,
          `SimulationDriver accumulator: ${runtime.accumulatorMs}`,
          `coreUpdateFrames / lastCoreUpdateRealAt: ${runtime.coreUpdateFrames} / ${runtime.lastCoreUpdateRealAt}`,
          `lastForegroundDeltaMs / consumedSteps: ${runtime.lastForegroundDeltaMs} / ${runtime.lastForegroundConsumedSteps}`,
          `fixedSimulationSteps / physicsSteps: ${runtime.fixedSimulationSteps} / ${runtime.physicsSteps}`,
          `lastSimulationStepRealAt: ${runtime.lastSimulationStepRealAt}`,
          `last simulation subsystem: ${runtime.lastSimulationSubsystem ?? "—"}`,
          `background mode / catch-up / debt: ${runtime.backgroundMode} / ${runtime.backgroundCatchUpActive} / ${runtime.catchUpDebtSteps}`,
          `catch-up source: ${runtime.catchUpSource} · last: ${runtime.lastCatchUpSource}`,
          `DESKTOP VISIBILITY CATCH-UP ERROR: ${runtime.desktopVisibilityCatchUpInvariantViolation}`,
          `worldInstanceId / runtimeMode: ${runtime.worldInstanceId} / ${runtime.runtimeMode}`,
          `Map pointer: lastTarget=${runtime.mapPointer?.lastTarget ?? "—"} accepted=${runtime.mapPointer?.accepted ?? "—"} reason=${runtime.mapPointer?.reason ?? "—"}`,
          `Map pointer selection: faction ${runtime.mapPointer?.selectedFactionNameBefore ?? "—"} → ${runtime.mapPointer?.selectedFactionNameAfter ?? "—"} · panel ${runtime.mapPointer?.rightPanelTabBefore ?? "—"} → ${runtime.mapPointer?.rightPanelTabAfter ?? "—"}`,
          `Resume probe: ${stableStringify(runtime.resumeProbe ?? null)}`,
          `Frame performance: ${stableStringify(runtime.framePerformance)}`,
          `World scale: ${stableStringify(runtime.worldScale)}`,
          `Renderer warnings: Canvas2D=${desktopDiagnostics?.canvasWarningCount ?? "browser n/a"} · texImage2D bad image=${desktopDiagnostics?.texImage2DBadImageWarningCount ?? "browser n/a"}`,
        ].join("\n")}</Typography>}
      </details>
      {runtimeUnits && <details>
        <summary>Runtime Units</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{[
          `logical users: ${runtimeUnits.logicalUsers}`,
          `root players: ${runtimeUnits.rootPlayers}`,
          `player children: ${runtimeUnits.playerChildren}`,
          `Player tree roots / reachable / edges / maxDepth / revisits: ${stableStringify(runtimeUnits.playerTree ?? null)}`,
          `active Phaser player objects: ${runtimeUnits.activePhaserPlayers}`,
          `avatar renderer: ${runtimeUnits.avatarRendererMode ?? getAvatarRendererMode()}`,
          `missing texture keys: ${runtimeUnits.missingTextureKeys.join(", ") || "none"}`,
          `noFace source / exists: ${runtimeUnits.noFaceSource} / ${runtimeUnits.noFaceTextureExists}`,
          `star texture exists: ${runtimeUnits.starTextureExists}`,
          `renderer type: ${runtimeUnits.rendererType}`,
        ].join("\n")}</Typography>
      </details>}
      {core && <details>
        <summary>Diplomacy</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{stableStringify(core.getDiplomacyDiagnostics())}</Typography>
      </details>}
      <details>
        <summary>Population Transition Audit（最近显著变化）</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{populationTransitions.length
          ? populationTransitions.map((entry) => {
            const related = entry.relatedFactionId
              ? core?.teams.find((team) => team.name === entry.relatedFactionId)?.displayName ?? entry.relatedFactionId
              : undefined;
            const relation = related ? ` | ${entry.delta < 0 ? "→" : "←"} ${related}` : "";
            return `${formatWorldDate(entry.month)} | ${entry.factionName} ${entry.before}→${entry.after} (${entry.delta > 0 ? "+" : ""}${entry.delta}) | ${entry.cause}${relation}${entry.context ? ` | ${entry.context}` : ""}`;
          }).join("\n")
          : "暂无达到阈值的人口变化"}</Typography>
      </details>
      {isDesktopContinuousRuntime() && <details open>
        <summary>Desktop Runtime</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{[
          "Mode: DESKTOP_CONTINUOUS",
          `Platform: ${desktopDiagnostics?.platform ?? window.gridGodDesktop?.platform ?? "unknown"}`,
          `Focused: ${desktopDiagnostics?.focused ? "yes" : "no"}`,
          `Visibility: ${desktopDiagnostics?.visibility ?? document.visibilityState}`,
          `World month: ${desktopRuntime?.worldMonth ?? worldMonth}`,
          `Running: ${desktopDiagnostics?.latestHeartbeat?.running ? "yes" : "no"} · Selected speed: ${desktopDiagnostics?.latestHeartbeat?.selectedSpeed ?? simulationSpeed}× · World instance: ${desktopDiagnostics?.latestHeartbeat?.worldInstanceId ?? "—"}`,
          `Fixed steps: ${desktopRuntime?.fixedSimulationSteps ?? 0}`,
          `Physics steps: ${desktopRuntime?.physicsSteps ?? 0}`,
          `Catch-up debt: ${desktopRuntime?.catchUpDebtSteps ?? 0}`,
          `Runtime mode: ${desktopRuntime?.runtimeMode ?? "DESKTOP_CONTINUOUS"}`,
          `Catch-up source: ${desktopRuntime?.catchUpSource ?? desktopDiagnostics?.latestHeartbeat?.catchUpSource ?? "NONE"} · last: ${desktopRuntime?.lastCatchUpSource ?? desktopDiagnostics?.latestHeartbeat?.lastCatchUpSource ?? "NONE"}`,
          `Background mode: ${desktopRuntime?.backgroundMode ?? desktopDiagnostics?.latestHeartbeat?.backgroundMode ?? "FOREGROUND"}`,
          `DESKTOP VISIBILITY CATCH-UP ERROR: ${desktopRuntime?.desktopVisibilityCatchUpInvariantViolation ?? desktopDiagnostics?.latestHeartbeat?.desktopVisibilityCatchUpInvariantViolation ?? false}`,
          `Heartbeat age: ${desktopDiagnostics?.heartbeatAgeSeconds?.toFixed(1) ?? "—"}s`,
          `Last autosave: ${desktopAutosave?.savedAt ? new Date(desktopAutosave.savedAt).toLocaleTimeString() : "—"} · ${desktopAutosave?.status ?? "—"}${desktopAutosave?.reason ? ` (${desktopAutosave.reason})` : ""}${desktopAutosave?.error ? ` (${desktopAutosave.error})` : ""}`,
          `Suspend count: ${desktopDiagnostics?.suspendCount ?? 0}`,
          `Suspend policy: ${readDesktopSuspendPolicy()}`,
          `Last suspend duration: ${desktopDiagnostics?.lastSuspendDurationMs === undefined ? "—" : `${(desktopDiagnostics.lastSuspendDurationMs / 1000).toFixed(1)} sec`}`,
          `Window minimized: ${desktopDiagnostics?.windowMinimized ? "yes" : "no"}`,
          `Minimize count: ${desktopDiagnostics?.minimizeCount ?? 0}`,
          `Last minimized: ${desktopDiagnostics?.lastMinimizedAt ?? "—"}`,
          `Last restored: ${desktopDiagnostics?.lastRestoredAt ?? "—"}`,
          `Resume catch-up: ${desktopDiagnostics?.resumeCatchUp ? `${desktopDiagnostics.resumeCatchUp.steps} steps / ${desktopDiagnostics.resumeCatchUp.complete ? "complete" : "pending"}${desktopDiagnostics.resumeCatchUp.truncated ? " / truncated" : ""}` : "—"}`,
        ].join("\n")}</Typography>
      </details>}
    </Box>
  );
}
