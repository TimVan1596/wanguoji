import { useEffect } from "react";
import Game from "../Game/Game";
import { IndexedDbWorldSaveRepository } from "../Persistence/WorldSaveRepository";
import {
  saveCurrentWorldExclusive,
  WorldSaveBusyError,
  WorldLaunchRequest,
} from "../Persistence/WorldSaveWorkflow";
import { DesktopAutosaveResult, DesktopResumeAfterSuspend } from "../Runtime/DesktopRuntime";

const repository = new IndexedDbWorldSaveRepository();

export default function DesktopLifecycleBridge({ launchRequest }: { launchRequest?: WorldLaunchRequest }) {
  useEffect(() => {
    const bridge = window.gridGodDesktop;
    if (!bridge) return;

    const options = launchRequest?.mode === "NEW_WORLD"
      ? { scenarioId: launchRequest.scenario.id, scenarioName: launchRequest.scenario.name }
      : launchRequest?.mode === "CONTINUE_SAVE"
      ? {
          scenarioId: launchRequest.record.save.scenarioId,
          scenarioName: launchRequest.record.summary.scenarioName,
        }
      : { scenarioName: "桌面世界" };

    const save = async (requestId?: string): Promise<DesktopAutosaveResult> => {
      const core = Game.Core;
      if (!core) return { requestId: requestId ?? "close", status: "SKIPPED", reason: "NO_RUNTIME" };
      const blocked = core.getDesktopSaveBlockReason();
      if (blocked === "NO_WORLD") return { requestId: requestId ?? "close", status: "SKIPPED", reason: "NO_WORLD" };
      if (blocked) return { requestId: requestId ?? "close", status: "SKIPPED", reason: blocked };
      try {
        const result = await saveCurrentWorldExclusive(core, repository, options);
        return {
          requestId: requestId ?? "close",
          status: "SAVED",
          worldMonth: result.record.summary.worldMonth,
          serializedBytes: result.serializedBytes,
          writeDurationMs: result.writeDurationMs,
          savedAt: result.record.savedAt,
        };
      } catch (error) {
        if (error instanceof WorldSaveBusyError) {
          return { requestId: requestId ?? "close", status: "SKIPPED", reason: "SAVE_BUSY" };
        }
        return {
          requestId: requestId ?? "close",
          status: "FAILED",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    const unsubscribeAutosave = bridge.onAutosaveRequested?.(({ requestId }) => {
      void save(requestId).then((result) => bridge.reportAutosaveResult?.(result));
    });
    const unsubscribeClose = bridge.onBeforeClose?.(() => {
      void save().then((result) => {
        bridge.reportCloseSaveResult?.({
          status: result.status === "SAVED" ? "SAVED" : result.reason === "NO_WORLD" ? "SKIPPED" : "FAILED",
          worldStarted: result.reason === "NO_WORLD" ? false : true,
          error: result.error ?? (result.status === "SKIPPED" ? result.reason : undefined),
        });
      });
    });
    const unsubscribeResume = bridge.onResumeAfterSuspend?.((payload) => {
      const result = Game.Core?.scheduleDesktopResumeCatchUp(payload as DesktopResumeAfterSuspend);
      bridge.reportResumeCatchUpResult?.({
        status: result?.scheduled ? "SCHEDULED" : "SKIPPED",
        steps: result?.steps ?? 0,
        truncated: result?.truncated ?? false,
      });
    });
    return () => {
      unsubscribeAutosave?.();
      unsubscribeClose?.();
      unsubscribeResume?.();
    };
  }, [launchRequest]);

  return null;
}
