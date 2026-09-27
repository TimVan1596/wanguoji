import { Box, Button, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import Game from "../../Game/Game";
import { getFactionStability } from "../../Components/City";
import WorldEra, { classifyEra } from "../../Simulation/WorldEra";
import { calculateTerritoryMetrics, getFactionTerritoryMetric } from "../../Simulation/TerritoryMetrics";
import { formatWorldDate, formatWorldDuration } from "../../Simulation/WorldTime";
import { RootState } from "../../store";
import { exportWorldSave } from "../../Persistence/WorldSaveExporter";
import { hydrateWorldSave, HydrationReport } from "../../Persistence/WorldSaveHydrator";
import { validateWorldSave } from "../../Persistence/WorldSaveValidator";
import { diffCanonicalWorldSave, type CanonicalWorldSaveDiff, type WorldSaveV1 } from "../../Persistence/WorldSaveSchema";
import { APP_VERSION } from "../../config/version";

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
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 500);
    return () => window.clearInterval(timer);
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
    return { ranked, currentEra, candidate, validity, liveClassification, cycle };
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
    `周期：${diagnostics.cycle?.stage ?? "—"}｜分裂年龄${diagnostics.cycle?.fragmentationAge ?? 0}月｜统一年龄${diagnostics.cycle?.unifiedAge ?? 0}月｜整合修正${(diagnostics.cycle?.consolidationModifier ?? 0).toFixed(2)}`,
    `整合领袖：${diagnostics.cycle?.consolidationLeaderId ?? "—"} 动量${(diagnostics.cycle?.consolidationLeaderMomentum ?? 0).toFixed(2)}｜霸权候选：${diagnostics.cycle?.hegemonicCandidateId ?? "—"} 动量${(diagnostics.cycle?.hegemonicMomentum ?? 0).toFixed(2)}｜围城倍率${(diagnostics.cycle?.hegemonicSiegeMultiplier ?? 1).toFixed(3)}`,
    `王朝秩序：${diagnostics.cycle?.dynasticOrderFactionId ?? "—"}`,
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
    `canonical diff summary:\n${subsystemSummary}`,
    `canonical path differences:\n${pathDiffSummary}`,
    `runtime liveness: ${JSON.stringify(runtime ?? null)}`,
    `simulation counters: ${JSON.stringify(core?.getSimulationDiagnostics() ?? null)}`,
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
        {snapshotRequest && <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>
          {`snapshot: ${snapshotRequest.status}｜request month ${snapshotRequest.requestMonth ?? "—"}｜reached ${snapshotRequest.boundaryReachedMonth ?? "waiting"}\nstarted while: simulator=${snapshotState?.simulatorRunning ?? "—"}, clock=${snapshotState?.clockRunning ?? "—"}, redux=${snapshotState?.reduxWorldRunning ?? "—"}, scenePaused=${snapshotState?.sceneTimePaused ?? "—"}, physicsPaused=${snapshotState?.physicsPaused ?? "—"}, accumulator=${snapshotState?.simulationAccumulatorMs ?? "—"}, elapsed=${snapshotState?.clockElapsedMs ?? "—"}\nwaiting reason: ${snapshotRequest.waitingReasons?.join(", ") || "none"}\npre-export elapsed=${snapshotRequest.preExportElapsedMs ?? "—"}, accumulator=${snapshotRequest.preExportAccumulatorMs ?? "—"}${snapshotRequest.error ? `\n${snapshotRequest.error}` : ""}`}
        </Typography>}
        <Typography component="pre" sx={{ whiteSpace: "pre-wrap", fontSize: 9 }}>{`last hydration stage: ${hydration?.lastStage ?? "—"}\n${hydrationStatus}\n${subsystemSummary}\n${pathDiffSummary}`}</Typography>
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
