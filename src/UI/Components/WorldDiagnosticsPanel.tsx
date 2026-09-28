import { Box, Button, Typography } from "@mui/material";
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
import {
  getWorldSaveStorageDiagnostics,
  subscribeWorldSaveStorageDiagnostics,
  WorldSaveStorageDiagnostics,
} from "../../Persistence/WorldSaveDiagnostics";

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
  const teams = useSelector((state: RootState) => state.root.teams);
  const worldMonth = useSelector((state: RootState) => state.root.worldMonth);
  const worldPhase = useSelector((state: RootState) => state.root.worldPhase);
  const [, setTick] = useState(0);
  const [hydrationBusy, setHydrationBusy] = useState(false);
  const [hydrationStatus, setHydrationStatus] = useState("");
  const [canonicalDiff, setCanonicalDiff] = useState<CanonicalWorldSaveDiff>();
  const [storageDiagnostics, setStorageDiagnostics] = useState<WorldSaveStorageDiagnostics>(getWorldSaveStorageDiagnostics);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 500);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const unsubscribe = subscribeWorldSaveStorageDiagnostics(setStorageDiagnostics);
    return () => { unsubscribe(); };
  }, []);

  const diagnostics = useMemo(() => {
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
    const candidate = WorldEra.getCandidateDiagnostics(worldMonth);
    const validity = WorldEra.getCurrentEraValidityDiagnostics(worldMonth);
    const liveClassification = classifyEra(
      teams,
      totalCells,
      worldMonth,
      worldPhase,
      currentEra
    );
    const cycle = Game.Core?.simulator?.getWorldCycleDiagnostics();
    const longRun = LongRunProfiler.getSummary(worldMonth, WorldEra.getEras(), cycle?.stage);
    return { ranked, currentEra, candidate, validity, liveClassification, cycle, longRun };
  }, [teams, worldMonth, worldPhase]);

  if (!debugEnabled()) {
    return null;
  }

  const summary = [
    `世界年月：${formatWorldDate(worldMonth)}（${worldMonth}月）`,
    `当前时代：${diagnostics.currentEra ? `${diagnostics.currentEra.type} · ${diagnostics.currentEra.name} · ${formatWorldDate(diagnostics.currentEra.startMonth)}起` : "暂无已确认时代"}`,
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
  ].join("\n");
  const snapshotRequest = Game.Core?.getSnapshotRequestDiagnostics();

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

  const core = Game.Core;
  const runtime = core?.getRuntimeLivenessDiagnostics();
  const hydration = core?.getHydrationDiagnostics();
  const snapshotState = snapshotRequest?.requestState;
  const subsystemSummary = canonicalDiff
    ? Object.entries(canonicalDiff.subsystemCounts).map(([key, count]) => `${key}: ${count}`).join("\n")
    : "暂无 canonical comparison";
  const pathDiffSummary = canonicalDiff?.differences.length
    ? canonicalDiff.differences.map((entry) => `${entry.path}\n  before: ${JSON.stringify(entry.before)}\n  after: ${JSON.stringify(entry.after)}`).join("\n")
    : "无 path-level 差异";
  const hydrationReport = [
    `Wanguoji ${APP_VERSION}`,
    `world month: ${runtime?.worldMonth ?? worldMonth}`,
    `Era: ${diagnostics.currentEra ? `${diagnostics.currentEra.type} ${diagnostics.currentEra.name} (${diagnostics.currentEra.startMonth})` : "none"}`,
    `WorldCycle: ${JSON.stringify(diagnostics.cycle ?? null)}`,
    `snapshot request: ${JSON.stringify(snapshotRequest ?? null)}`,
    `last hydration: ${hydrationStatus || "none"}`,
    `last hydration stage: ${hydration?.lastStage ?? "unknown"}`,
    `collider teardown: ${JSON.stringify(core?.getColliderTeardownDiagnostics() ?? null)}`,
    `canonical diff summary:\n${subsystemSummary}`,
    `canonical path differences:\n${pathDiffSummary}`,
    `runtime liveness: ${JSON.stringify(runtime ?? null)}`,
    `simulation counters: ${JSON.stringify(core?.getSimulationDiagnostics() ?? null)}`,
    `stored save diagnostics: ${JSON.stringify(storageDiagnostics)}`,
  ].join("\n\n");
  const statusSummary = `Hydration: ${hydrationStatus.startsWith("Hydration OK") ? "OK" : hydrationStatus.startsWith("Hydration failed") ? "FAILED" : "—"}｜Canonical: ${canonicalDiff ? canonicalDiff.matched ? "matched" : `DIFF (${canonicalDiff.differenceCount})` : "—"}｜Runtime: ${runtime?.simulatorRunning ? "RUNNING" : "PAUSED"}`;

  return (
    <Box sx={{ position: "fixed", zIndex: 5000, right: 350, bottom: 8, width: 360, maxHeight: "48vh", overflowY: "auto", p: 1, bgcolor: "rgba(20,24,28,.95)", color: "#fff", border: "1px solid #90caf9", fontSize: 11 }}>
      <Typography variant="subtitle2" sx={{ color: "#90caf9" }}>世界诊断（debug=1）</Typography>
      <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9, my: 0.5 }}>{statusSummary}</Typography>
      <Button size="small" variant="outlined" sx={{ color: "#90caf9", borderColor: "#90caf9" }} onClick={() => navigator.clipboard?.writeText(hydrationReport)}>复制 Hydration 调试报告</Button>
      <Button size="small" variant="outlined" disabled={hydrationBusy} sx={{ ml: 0.5, color: "#a5d6a7", borderColor: "#a5d6a7" }} onClick={snapshotAndReload}>
        {hydrationBusy ? "正在重载…" : "内存快照并重载"}
      </Button>
      <details>
        <summary>世界格局</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{summary}</Typography>
        <Typography variant="caption">关键门槛（仅解释真实规则，不改变规则）</Typography>
        {thresholds.map(([label, text]) => <Typography key={label} variant="caption" component="div">{label}：{text}</Typography>)}
      </details>
      <details>
        <summary>Persistence / Hydration</summary>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{`Stored save: ${storageDiagnostics.status}\nsavedAt=${storageDiagnostics.savedAt ?? "—"}｜month=${storageDiagnostics.worldMonth ?? "—"}｜schema=${storageDiagnostics.schemaVersion ?? "—"}\nlast action=${storageDiagnostics.lastAction ?? "—"}${storageDiagnostics.serializedBytes === undefined ? "" : `｜JSON bytes=${storageDiagnostics.serializedBytes}｜IDB write=${storageDiagnostics.writeDurationMs?.toFixed(2)}ms`}${storageDiagnostics.error ? `\n${storageDiagnostics.error}` : ""}`}</Typography>
        {snapshotRequest && <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>
          {`snapshot: ${snapshotRequest.status}｜request month ${snapshotRequest.requestMonth ?? "—"}｜reached ${snapshotRequest.boundaryReachedMonth ?? "waiting"}\nstarted while: simulator=${snapshotState?.simulatorRunning ?? "—"}, clock=${snapshotState?.clockRunning ?? "—"}, redux=${snapshotState?.reduxWorldRunning ?? "—"}, scenePaused=${snapshotState?.sceneTimePaused ?? "—"}, physicsPaused=${snapshotState?.physicsPaused ?? "—"}, accumulator=${snapshotState?.simulationAccumulatorMs ?? "—"}, elapsed=${snapshotState?.clockElapsedMs ?? "—"}\nwaiting reason: ${snapshotRequest.waitingReasons?.join(", ") || "none"}\npre-export elapsed=${snapshotRequest.preExportElapsedMs ?? "—"}, accumulator=${snapshotRequest.preExportAccumulatorMs ?? "—"}${snapshotRequest.error ? `\n${snapshotRequest.error}` : ""}`}
        </Typography>}
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{`last hydration stage: ${hydration?.lastStage ?? "—"}\n${hydrationStatus}\n${subsystemSummary}\n${pathDiffSummary}`}</Typography>
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{`Collider teardown: ${JSON.stringify(core?.getColliderTeardownDiagnostics() ?? null)}`}</Typography>
      </details>
      <details>
        <summary>Runtime Liveness</summary>
        {runtime && <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{[
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
          `background mode / catch-up / debt: ${runtime.backgroundMode} / ${runtime.backgroundCatchUpActive} / ${runtime.catchUpDebtSteps}`,
          `worldInstanceId / runtimeMode: ${runtime.worldInstanceId} / ${runtime.runtimeMode}`,
          `Resume probe: ${JSON.stringify(runtime.resumeProbe ?? null)}`,
        ].join("\n")}</Typography>}
      </details>
    </Box>
  );
}
