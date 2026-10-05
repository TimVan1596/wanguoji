import { APP_VERSION } from "../config/version";
import Game from "../Game/Game";
import { store } from "../store";
import { formatRendererCrashReport } from "./RendererCrashReport";
export { formatRendererCrashReport } from "./RendererCrashReport";

function safeRead<T>(read: () => T, fallback: T): T {
  try { return read(); } catch { return fallback; }
}

export function createRendererCrashReport(error: unknown, source = "renderer") {
  const state = safeRead(() => store.getState().root, undefined);
  const normalized = error instanceof Error ? error : new Error(String(error));
  const core = Game.Core;
  const runtimeUnits = safeRead(() => core?.getRuntimeUnitDiagnostics(), undefined);
  const worldScale = safeRead(() => core?.getWorldScaleDiagnostics(), undefined);
  return formatRendererCrashReport({
    source,
    appVersion: APP_VERSION,
    worldMonth: state?.worldMonth ?? core?.simulator?.year ?? 0,
    errorName: normalized.name,
    message: normalized.message,
    stack: normalized.stack ?? `${normalized.name}: ${normalized.message}`,
    rightPanelTab: state?.rightPanelTab ?? "unknown",
    factionTab: state?.factionDetailTab ?? "unknown",
    selectedFactionName: state?.selectedFactionName ?? null,
    worldRunning: state?.worldRunning ?? false,
    simulationSpeed: state?.simulationSpeed ?? 1,
    lastSimulationSubsystem: safeRead(() => core?.getLastSimulationSubsystem(), "unknown") ?? "unknown",
    runtimeUnits,
    worldScale,
  });
}

export function reportRendererCrash(error: unknown, source = "renderer") {
  const report = createRendererCrashReport(error, source);
  try { Game.Core?.setWorldRunning(false); } catch { /* preserve the original fatal report */ }
  console.error(report);
  window.gridGodDesktop?.reportFatalRendererError?.(report);
  return report;
}

export function installRendererCrashListeners(target: Window = window) {
  const onError = (event: ErrorEvent) => {
    reportRendererCrash(event.error ?? new Error(event.message || "Unknown window error"), "window.error");
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    reportRendererCrash(event.reason, "unhandledrejection");
  };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
}
