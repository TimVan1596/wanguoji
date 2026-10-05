import Box from "@mui/material/Box";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Game from "../Game/Game";
import { InitialPopulationMap } from "../Simulation/PopulationSystem";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import {
  createWorldLaunchRunner,
  continueStoredWorldSave,
  saveCurrentWorldExclusive,
  WorldLaunchRequest,
} from "../Persistence/WorldSaveWorkflow";
import { IndexedDbWorldSaveRepository } from "../Persistence/WorldSaveRepository";
import { setWorldSaveStorageDiagnostics } from "../Persistence/WorldSaveDiagnostics";
import { formatWorldDate } from "../Simulation/WorldTime";
import { registerActiveWorldPersistence, saveActiveWorld } from "../Persistence/ActiveWorldPersistence";
import { chooseAutosaveSlot, GameYearAutosaveSchedule } from "../Persistence/SaveSlotRules";
import { store } from "../store";
import Config from "./Components/Config";
import ChapterBanner from "./Components/ChapterBanner";
import BackgroundCatchUpOverlay from "./Components/BackgroundCatchUpOverlay";
import GameCard from "./Components/GameCard";
import LeftSlider from "./Components/LeftSlider";
import { Result } from "./Components/Result";
import RightSlider from "./Components/RightSlider";
import WorldDiagnosticsPanel from "./Components/WorldDiagnosticsPanel";
import SaveManagerDialog from "./Components/SaveManagerDialog";
import { StoredWorldSaveRecord } from "../Persistence/WorldSaveRepository";
import {
  closeSaveManagerSession,
  pauseForSaveManager,
  restoreAfterFailedSaveLoad,
  SaveManagerRuntimeSession,
} from "../Persistence/SaveManagerRuntimeSession";
import worldRandom from "../Simulation/WorldRandom";

interface AppProps {
  launchRequest: WorldLaunchRequest;
  onReturnToMenu: () => void;
  onLoadRecord: (record: StoredWorldSaveRecord) => void;
}

export default function App({ launchRequest, onReturnToMenu, onLoadRecord }: AppProps) {
  const [saving, setSaving] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [saveManagerOpen, setSaveManagerOpen] = useState(false);
  const [activeLaunchRequest, setActiveLaunchRequest] = useState(launchRequest);
  const saveManagerSession = useRef<SaveManagerRuntimeSession>();
  const worldMonth = useSelector((state: RootState) => state.root.worldMonth);
  const worldStarted = useSelector((state: RootState) => state.root.worldStarted);
  const catchUpActive = useSelector((state: RootState) => state.root.backgroundCatchUpActive);
  const saveSchedule = useMemo(() => new GameYearAutosaveSchedule(
    activeLaunchRequest.mode === "CONTINUE_SAVE" ? activeLaunchRequest.record.summary.worldMonth : 0
  ), [activeLaunchRequest]);
  const autosaveInFlight = useRef(false);
  const pendingAutosaveBoundary = useRef<number>();

  const openSaveManager = () => {
    const state = store.getState().root;
    saveManagerSession.current = state.worldStarted ? pauseForSaveManager(Game.Core) : undefined;
    setSaveManagerOpen(true);
  };

  const closeSaveManager = () => {
    setSaveManagerOpen(false);
    const session = saveManagerSession.current;
    if (session?.closeReason === "LOAD") return;
    saveManagerSession.current = undefined;
    closeSaveManagerSession(Game.Core, session);
  };

  const loadSaveFromManager = (record: StoredWorldSaveRecord) => {
    if (saveManagerSession.current) saveManagerSession.current.closeReason = "LOAD";
    onLoadRecord(record);
  };

  const handleLoadFailure = useCallback((safeToResume: boolean) => {
    if (safeToResume) restoreAfterFailedSaveLoad(Game.Core, saveManagerSession.current);
    saveManagerSession.current = undefined;
  }, []);

  const handleLoadSuccess = useCallback((loadedRequest: WorldLaunchRequest) => {
    setActiveLaunchRequest(loadedRequest);
    if (saveManagerSession.current?.closeReason === "LOAD") saveManagerSession.current = undefined;
  }, []);

  useEffect(() => registerActiveWorldPersistence({
    isWorldStarted: () => store.getState().root.worldStarted,
    getCore: () => Game.Core,
    save: (core, target) => {
      const scenario = activeLaunchRequest.mode === "NEW_WORLD" ? activeLaunchRequest.scenario : undefined;
      const scenarioId = activeLaunchRequest.mode === "CONTINUE_SAVE" ? activeLaunchRequest.record.save.scenarioId : scenario?.id;
      const scenarioName = activeLaunchRequest.mode === "CONTINUE_SAVE" ? activeLaunchRequest.record.summary.scenarioName : scenario?.name;
      return saveCurrentWorldExclusive(core, new IndexedDbWorldSaveRepository(), { scenarioId, scenarioName, ...target });
    },
  }), [activeLaunchRequest]);

  useEffect(() => {
    if (!worldStarted) return;
    const crossedBoundary = saveSchedule.observe(worldMonth);
    if (crossedBoundary !== undefined && pendingAutosaveBoundary.current === undefined) {
      pendingAutosaveBoundary.current = crossedBoundary;
    }
    if (pendingAutosaveBoundary.current === undefined || catchUpActive || autosaveInFlight.current) return;
    autosaveInFlight.current = true;
    const saveAutoslot = async () => {
      try {
        const slotId = await chooseAutosaveSlot(new IndexedDbWorldSaveRepository());
        const result = await saveActiveWorld({
          slotId,
          slotType: "AUTOSAVE",
          waitForBusy: true,
          timeoutMs: 30_000,
        });
        if (result.status === "SAVED") {
          pendingAutosaveBoundary.current = undefined;
          Game.Core?.toast?.showMessage(`自动存档已保存 · ${formatWorldDate(result.result.record.summary.worldMonth)}`);
        } else if (result.status === "FAILED") {
          console.error("[Wanguoji] game-year autosave failed", result);
          const retryable = ["SAVE_BUSY", "CATCHING_UP", "HYDRATION", "SNAPSHOT", "RUNTIME_INITIALIZING"].includes(result.reason);
          if (!retryable) pendingAutosaveBoundary.current = undefined;
          Game.Core?.toast?.showMessage(retryable ? "自动存档将在安全状态下重试" : `自动存档失败：${result.reason}`);
        }
      } catch (error) {
        console.error("[Wanguoji] game-year autosave failed", error);
        pendingAutosaveBoundary.current = undefined;
        Game.Core?.toast?.showMessage("自动存档失败");
      } finally {
        autosaveInFlight.current = false;
      }
    };
    void saveAutoslot();
  }, [worldMonth, worldStarted, catchUpActive, saveSchedule]);

  const handleSave = async () => {
    setSaving(true);
    setWorldSaveStorageDiagnostics({ status: "unknown", lastAction: "正在保存" });
    try {
      const saved = await saveActiveWorld({ slotId: "current", slotType: "RECOVERY" });
      if (saved.status !== "SAVED") throw new Error(("error" in saved ? saved.error : undefined) ?? `无法保存：${saved.reason}`);
      const result = saved.result;
      setWorldSaveStorageDiagnostics({
        status: "present",
        savedAt: result.record.savedAt,
        worldMonth: result.record.summary.worldMonth,
        schemaVersion: result.record.saveSchemaVersion,
        lastAction: "保存成功",
        serializedBytes: result.serializedBytes,
        writeDurationMs: result.writeDurationMs,
        waitSafeBoundaryMs: result.waitSafeBoundaryMs,
        exportSerializeMs: result.exportSerializeMs,
        indexedDbWriteMs: result.indexedDbWriteMs,
        totalSaveDurationMs: result.totalSaveDurationMs,
      });
      const date = formatWorldDate(result.record.summary.worldMonth);
      Game.Core.toast?.showMessage(`恢复档已更新 · ${date}`);
      return `恢复档已更新 · ${date}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorldSaveStorageDiagnostics({ status: "error", lastAction: "保存失败", error: message });
      throw error;
    } finally {
      setSaving(false);
    }
  };
  const handleManualSave = async (displayName: string) => {
    const trimmedName = displayName.trim();
    if (!trimmedName) throw new Error("存档名称不能为空");
    setSaving(true);
    setWorldSaveStorageDiagnostics({ status: "unknown", lastAction: "正在创建手动存档" });
    try {
      const result = await saveActiveWorld({ slotType: "MANUAL", displayName: trimmedName, waitForBusy: true });
      if (result.status !== "SAVED") throw new Error(("error" in result ? result.error : undefined) ?? `无法保存：${result.reason}`);
      const saved = result.result;
      const date = formatWorldDate(saved.record.summary.worldMonth);
      setWorldSaveStorageDiagnostics({
        status: "present",
        savedAt: saved.record.savedAt,
        worldMonth: saved.record.summary.worldMonth,
        schemaVersion: saved.record.saveSchemaVersion,
        lastAction: `手动存档：${trimmedName}`,
        serializedBytes: saved.serializedBytes,
        writeDurationMs: saved.writeDurationMs,
        waitSafeBoundaryMs: saved.waitSafeBoundaryMs,
        exportSerializeMs: saved.exportSerializeMs,
        indexedDbWriteMs: saved.indexedDbWriteMs,
        totalSaveDurationMs: saved.totalSaveDurationMs,
      });
      Game.Core?.toast?.showMessage(`手动存档已保存 · ${date}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorldSaveStorageDiagnostics({ status: "error", lastAction: "手动存档失败", error: message });
      throw error;
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <WorldStarter launchRequest={launchRequest} onLoadFailure={handleLoadFailure} onLoadSuccess={handleLoadSuccess} />
      <Result onReturnToMenu={onReturnToMenu}></Result>
      <Config open={configOpen} onClose={() => setConfigOpen(false)} />
      <Box
        sx={{
          boxSizing: "border-box",
          height: "100vh",
          display: "flex",
          background: "var(--gg-background)",
        }}
      >
        <Box
          sx={{
            width: { xs: 250, xl: 270 },
            flex: "0 0 auto",
            borderRight: "1px solid var(--gg-border)",
            background: "var(--gg-panel)",
          }}
        >
          <LeftSlider></LeftSlider>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
          <GameCard />
          <ChapterBanner />
          <BackgroundCatchUpOverlay />
        </Box>
        <Box
          sx={{
            width: { xs: 310, xl: 330 },
            flex: "0 0 auto",
            borderLeft: "1px solid var(--gg-border)",
            background: "var(--gg-panel)",
          }}
        >
          <RightSlider
            onReturnToMenu={onReturnToMenu}
            onSave={handleSave}
            onSaveGame={openSaveManager}
            onManageSaves={openSaveManager}
            onSettings={() => setConfigOpen(true)}
            saving={saving}
          />
        </Box>
      </Box>
      <WorldDiagnosticsPanel />
      <SaveManagerDialog
        open={saveManagerOpen}
        onClose={closeSaveManager}
        onLoad={loadSaveFromManager}
        onCreateManual={handleManualSave}
        defaultName={`${activeLaunchRequest.mode === "NEW_WORLD" ? activeLaunchRequest.scenario.name : activeLaunchRequest.record.summary.scenarioName ?? "万国纪"} · ${formatWorldDate(worldMonth)}`}
        title="保存游戏 / 存档管理"
      />
    </>
  );
}

function WorldStarter({ launchRequest, onLoadFailure, onLoadSuccess }: {
  launchRequest: WorldLaunchRequest;
  onLoadFailure: (safeToResume: boolean) => void;
  onLoadSuccess: (request: WorldLaunchRequest) => void;
}) {
  const teams = useSelector((state: RootState) => state.root.teams);
  const worldStarted = useSelector(
    (state: RootState) => state.root.worldStarted
  );
  const launchRunner = useMemo(() => createWorldLaunchRunner(launchRequest, {
      startWorld: (scenario, seed) => {
        if (worldRandom.exportState().seed !== seed) throw new Error("World seed changed between setup and launch");
        const populations: InitialPopulationMap = Object.fromEntries(
          scenario.factions.map((faction) => [
            faction.name,
            Math.max(0, Math.floor(faction.initialPopulation)),
          ])
        );
        Game.Core.startWorld(populations);
      },
      hydrate: (record) => {
        void continueStoredWorldSave(Game.Core, record)
          .then(() => onLoadSuccess(launchRequest))
          .catch((error) => {
            console.error("[Wanguoji] Continue hydration failed", error);
            const stage = Game.Core.getHydrationStage();
            onLoadFailure(stage === "IDLE" || stage === "COMPLETE" || stage === "PRECHECK");
            window.alert(`读取世界失败：${error instanceof Error ? error.message : String(error)}`);
          });
      },
    }), [launchRequest, onLoadFailure, onLoadSuccess]);

  useEffect(() => {
    if (
      !Game.Core ||
      !Game.Core.simulator ||
      !Game.Core.map ||
      (launchRequest.mode === "NEW_WORLD" && teams.length === 0)
    ) {
      return;
    }
    launchRunner();
  }, [launchRunner, launchRequest, teams, worldStarted]);

  return null;
}
