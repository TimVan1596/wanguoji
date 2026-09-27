import Box from "@mui/material/Box";
import { useEffect, useRef, useState } from "react";
import Game from "../Game/Game";
import { InitialPopulationMap } from "../Simulation/PopulationSystem";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { hydrateWorldSave } from "../Persistence/WorldSaveHydrator";
import {
  createWorldLaunchRunner,
  WorldLaunchRequest,
} from "../Persistence/WorldSaveWorkflow";
import { saveCurrentWorld } from "../Persistence/WorldSaveWorkflow";
import { IndexedDbWorldSaveRepository } from "../Persistence/WorldSaveRepository";
import { setWorldSaveStorageDiagnostics } from "../Persistence/WorldSaveDiagnostics";
import Config from "./Components/Config";
import ChapterBanner from "./Components/ChapterBanner";
import BackgroundCatchUpOverlay from "./Components/BackgroundCatchUpOverlay";
import GameCard from "./Components/GameCard";
import LeftSlider from "./Components/LeftSlider";
import { Result } from "./Components/Result";
import RightSlider from "./Components/RightSlider";
import WorldDiagnosticsPanel from "./Components/WorldDiagnosticsPanel";

interface AppProps {
  launchRequest: WorldLaunchRequest;
  onReturnToMenu: () => void;
}

export default function App({ launchRequest, onReturnToMenu }: AppProps) {
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!Game.Core || saving) throw new Error("当前无法保存世界");
    setSaving(true);
    setWorldSaveStorageDiagnostics({ status: "unknown", lastAction: "正在保存" });
    try {
      const scenario = launchRequest.mode === "NEW_WORLD" ? launchRequest.scenario : undefined;
      const result = await saveCurrentWorld(
        Game.Core,
        new IndexedDbWorldSaveRepository(),
        {
          scenarioId: scenario?.id ?? launchRequest.record.save.scenarioId,
          scenarioName: scenario?.name ?? launchRequest.record.summary.scenarioName,
        }
      );
      setWorldSaveStorageDiagnostics({
        status: "present",
        savedAt: result.record.savedAt,
        worldMonth: result.record.summary.worldMonth,
        schemaVersion: result.record.saveSchemaVersion,
        lastAction: "保存成功",
        serializedBytes: result.serializedBytes,
        writeDurationMs: result.writeDurationMs,
      });
      Game.Core.toast?.showMessage(`已保存 · ${result.record.summary.worldMonth}月`);
      return `已保存 · ${result.record.summary.worldMonth}月`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setWorldSaveStorageDiagnostics({ status: "error", lastAction: "保存失败", error: message });
      throw error;
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <WorldStarter launchRequest={launchRequest} />
      <Result onReturnToMenu={onReturnToMenu}></Result>
      <Config></Config>
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
          <RightSlider onReturnToMenu={onReturnToMenu} onSave={handleSave} saving={saving}></RightSlider>
        </Box>
      </Box>
      <WorldDiagnosticsPanel />
    </>
  );
}

function WorldStarter({ launchRequest }: { launchRequest: WorldLaunchRequest }) {
  const teams = useSelector((state: RootState) => state.root.teams);
  const worldStarted = useSelector(
    (state: RootState) => state.root.worldStarted
  );
  const launchRef = useRef<(() => boolean) | undefined>(undefined);
  if (!launchRef.current) {
    launchRef.current = createWorldLaunchRunner(launchRequest, {
      startWorld: (scenario) => {
        const populations: InitialPopulationMap = Object.fromEntries(
          scenario.factions.map((faction) => [
            faction.name,
            Math.max(0, Math.floor(faction.initialPopulation)),
          ])
        );
        Game.Core.startWorld(populations);
      },
      hydrate: (record) => {
        try {
          hydrateWorldSave(Game.Core, record.save);
        } catch (error) {
          console.error("[Wanguoji] Continue hydration failed", error);
          window.alert(`读取世界失败：${error instanceof Error ? error.message : String(error)}`);
        }
      },
    });
  }

  useEffect(() => {
    if (
      worldStarted ||
      !Game.Core ||
      (launchRequest.mode === "NEW_WORLD" && teams.length === 0)
    ) {
      return;
    }
    launchRef.current?.();
  }, [launchRequest, teams, worldStarted]);

  return null;
}
