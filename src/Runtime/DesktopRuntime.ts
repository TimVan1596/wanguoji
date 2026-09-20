export type GridGodRuntimeMode = "WEB_CATCH_UP" | "DESKTOP_CONTINUOUS";

export interface GridGodDesktopHeartbeat {
  worldMonth: number;
  fixedSteps: number;
  physicsSteps: number;
  catchUpDebtSteps: number;
  documentVisibilityState: DocumentVisibilityState | "unknown";
  focused: boolean;
  timestamp: number;
}

export interface GridGodDesktopBridge {
  isDesktop: true;
  platform: string;
  electronVersion?: string;
  sendHeartbeat?: (payload: GridGodDesktopHeartbeat) => void;
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
