import { useEffect } from "react";
import Game from "../Game/Game";
import { saveActiveWorld } from "../Persistence/ActiveWorldPersistence";
import { DesktopAutosaveResult, DesktopResumeAfterSuspend } from "../Runtime/DesktopRuntime";
import { getResumeCatchUpRequest, readDesktopSuspendPolicy } from "../Runtime/DesktopSuspendPolicy";

export default function DesktopLifecycleBridge() {
  useEffect(() => {
    const bridge = window.gridGodDesktop;
    if (!bridge) return;
    const save = async (requestId?: string): Promise<DesktopAutosaveResult> => {
      const active = await saveActiveWorld({ waitForBusy: requestId === undefined, timeoutMs: 9_000 }).catch((error) => ({
        status: "FAILED" as const,
        reason: "SAVE_FAILED" as const,
        error: error instanceof Error ? error.message : String(error),
      }));
      if (active.status === "SAVED") {
        const result = active.result;
        return {
          requestId: requestId ?? "close",
          status: "SAVED",
          worldMonth: result.record.summary.worldMonth,
          serializedBytes: result.serializedBytes,
          writeDurationMs: result.writeDurationMs,
          savedAt: result.record.savedAt,
        };
      }
      if (active.status === "SKIPPED") {
        return { requestId: requestId ?? "close", status: "SKIPPED", reason: active.reason };
      }
      return { requestId: requestId ?? "close", status: "FAILED", reason: active.reason, error: active.error };
    };

    const unsubscribeAutosave = bridge.onAutosaveRequested?.(({ requestId }) => {
      void save(requestId).then((result) => bridge.reportAutosaveResult?.(result));
    });
    const unsubscribeClose = bridge.onBeforeClose?.(() => {
      void save().then((result) => {
        bridge.reportCloseSaveResult?.({
          status: result.status,
          worldStarted: result.reason === "NO_WORLD" ? false : true,
          error: result.error ?? result.reason,
        });
      });
    });
    const unsubscribeResume = bridge.onResumeAfterSuspend?.((payload) => {
      const request = getResumeCatchUpRequest(
        payload as DesktopResumeAfterSuspend,
        readDesktopSuspendPolicy()
      );
      const result = Game.Core?.scheduleDesktopResumeCatchUp(request);
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
  }, []);

  return null;
}
