import type { DesktopAppSuspensionBlocker } from "../../desktop/DesktopAppSuspensionBlocker";
import type { DesktopWakeMessage, installDesktopWakeLifecycle } from "../../desktop/DesktopWakeLifecycle";
export type GridGodRuntimeMode = "WEB_CATCH_UP" | "DESKTOP_CONTINUOUS";
export type GridGodRouterMode = "browser" | "hash";
export type BackgroundCatchUpSource = "NONE" | "WEB_VISIBILITY" | "DESKTOP_OS_RESUME";
export type BackgroundMode = "FOREGROUND" | "CATCH_UP";

export function getGridGodRouterMode(isDesktop: boolean): GridGodRouterMode {
  return isDesktop ? "hash" : "browser";
}

export interface GridGodDesktopHeartbeat {
  worldMonth: number;
  fixedSteps: number;
  physicsSteps: number;
  catchUpDebtSteps: number;
  documentVisibilityState: DocumentVisibilityState | "unknown";
  focused: boolean;
  timestamp: number;
  running: boolean;
  worldStarted: boolean;
  selectedSpeed: number;
  worldInstanceId: number;
  catchUpTotalSteps: number;
  catchUpCompletedSteps: number;
  catchUpTruncated: boolean;
  catchUpSource: BackgroundCatchUpSource;
  lastCatchUpSource: BackgroundCatchUpSource;
  backgroundMode: BackgroundMode;
  desktopVisibilityCatchUpInvariantViolation: boolean;
}

export interface DesktopAutosaveResult {
  requestId: string;
  status: "SAVED" | "SKIPPED" | "FAILED";
  reason?: string;
  worldMonth?: number;
  serializedBytes?: number;
  writeDurationMs?: number;
  waitSafeBoundaryMs?: number;
  exportSerializeMs?: number;
  indexedDbWriteMs?: number;
  totalSaveDurationMs?: number;
  savedAt?: string;
  error?: string;
}

export interface DesktopResumeAfterSuspend {
  elapsedRealMs: number;
  wasRunning: boolean;
  selectedSpeed: number;
  worldInstanceId?: number;
}

export interface DesktopDiagnostics {
  appSuspensionBlocker?: ReturnType<DesktopAppSuspensionBlocker["snapshot"]>;
  requestedFrameScheduler?: "RAF" | "SET_TIMEOUT";
  power?: ReturnType<ReturnType<typeof installDesktopWakeLifecycle>["snapshot"]>;
  platform: string;
  focused: boolean;
  visibility: string;
  heartbeatAgeSeconds?: number;
  latestHeartbeat?: Partial<GridGodDesktopHeartbeat>;
  lastAutosaveResult?: DesktopAutosaveResult;
  suspendCount: number;
  lastSuspendDurationMs?: number;
  resumeCatchUp?: { steps: number; truncated: boolean; complete: boolean };
  rendererCrash?: { reason: string; exitCode: number; at: string };
  canvasWarningCount?: number;
  texImage2DBadImageWarningCount?: number;
  windowMinimized?: boolean;
  minimizeCount?: number;
  lastMinimizedAt?: string;
  lastRestoredAt?: string;
}

export interface GridGodDesktopBridge {
  isDesktop: true;
  debugLaunchOptions?: { readonly debug: boolean; readonly forceTimeoutLoop: boolean };
  platform: string;
  electronVersion?: string;
  sendHeartbeat?: (payload: GridGodDesktopHeartbeat) => void;
  onAutosaveRequested?: (callback: (payload: { requestId: string }) => void) => () => void;
  reportAutosaveResult?: (payload: DesktopAutosaveResult) => void;
  onBeforeClose?: (callback: () => void) => () => void;
  reportCloseSaveResult?: (payload: { status: "SAVED" | "FAILED" | "SKIPPED"; worldStarted?: boolean; error?: string }) => void;
  onDesktopWake?: (callback: (payload: DesktopWakeMessage) => void) => () => void;
  onResumeAfterSuspend?: (callback: (payload: DesktopResumeAfterSuspend) => void) => () => void;
  reportResumeCatchUpResult?: (payload: { status: "SCHEDULED" | "SKIPPED"; steps?: number; truncated?: boolean }) => void;
  getDiagnostics?: () => Promise<DesktopDiagnostics>;
  reportFatalRendererError?: (report: string) => void;
}

declare global {
  interface Window {
    gridGodDesktop?: GridGodDesktopBridge;
  }
}

export function getGridGodRuntimeMode(
  targetWindow: Pick<Window, "gridGodDesktop"> | undefined =
    typeof window === "undefined" ? undefined : window
): GridGodRuntimeMode {
  return targetWindow?.gridGodDesktop?.isDesktop === true
    ? "DESKTOP_CONTINUOUS"
    : "WEB_CATCH_UP";
}

export function isDesktopContinuousRuntime(
  targetWindow: Pick<Window, "gridGodDesktop"> | undefined =
    typeof window === "undefined" ? undefined : window
) {
  return getGridGodRuntimeMode(targetWindow) === "DESKTOP_CONTINUOUS";
}
