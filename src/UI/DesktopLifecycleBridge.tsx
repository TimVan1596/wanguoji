import { useEffect, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
import Game from "../Game/Game";
import { saveActiveWorld } from "../Persistence/ActiveWorldPersistence";
import { DesktopAutosaveResult, DesktopResumeAfterSuspend } from "../Runtime/DesktopRuntime";
import { getDesktopResumePolicyDecision, readDesktopSuspendPolicy } from "../Runtime/DesktopSuspendPolicy";

export default function DesktopLifecycleBridge() {
  const [resumeNotice, setResumeNotice] = useState<{ title: string; detail: string }>();
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
      const core = Game.Core;
      const runtimeWorldInstanceId = core?.getRuntimeLivenessDiagnostics().worldInstanceId;
      const sameWorld = payload.worldInstanceId !== undefined && payload.worldInstanceId === runtimeWorldInstanceId;
      const currentWorldRunning = sameWorld ? core?.simulator?.isRunning() ?? payload.wasRunning : false;
      const decision = getDesktopResumePolicyDecision(
        { ...payload as DesktopResumeAfterSuspend, wasRunning: currentWorldRunning },
        readDesktopSuspendPolicy()
      );
      const result = core?.scheduleDesktopResumeCatchUp(decision.catchUpRequest);
      if (sameWorld && decision.pauseWorldAfterResume) core?.setWorldRunning(false);
      if (sameWorld && decision.notice && core?.simulator?.exportState().started) {
        setResumeNotice(decision.notice);
      }
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

  return (
    <Snackbar open={Boolean(resumeNotice)} autoHideDuration={9000} onClose={() => setResumeNotice(undefined)}>
      {resumeNotice ? (
        <Alert severity="info" variant="filled" onClose={() => setResumeNotice(undefined)}>
          <strong>{resumeNotice.title}</strong>
          <div>{resumeNotice.detail}</div>
        </Alert>
      ) : undefined}
    </Snackbar>
  );
}
