import type { DesktopResumeAfterSuspend } from "./DesktopRuntime";

export type DesktopSuspendPolicy = "PAUSE" | "CATCH_UP";

export const DESKTOP_SUSPEND_POLICY_STORAGE_KEY = "wanguoji.desktopSuspendPolicy";
export const DEFAULT_DESKTOP_SUSPEND_POLICY: DesktopSuspendPolicy = "PAUSE";
export const DESKTOP_SUSPEND_POLICY_LABELS: Record<DesktopSuspendPolicy, string> = {
  PAUSE: "暂停，并在唤醒后等待继续（推荐）",
  CATCH_UP: "唤醒后补算离线时间",
};

export interface DesktopResumePolicyDecision {
  catchUpRequest: DesktopResumeAfterSuspend;
  pauseWorldAfterResume: boolean;
  notice?: { title: string; detail: string };
}

export function parseDesktopSuspendPolicy(value: unknown): DesktopSuspendPolicy {
  return value === "CATCH_UP" ? "CATCH_UP" : "PAUSE";
}

export function readDesktopSuspendPolicy(
  storage: Pick<Storage, "getItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage
): DesktopSuspendPolicy {
  try {
    return parseDesktopSuspendPolicy(storage?.getItem(DESKTOP_SUSPEND_POLICY_STORAGE_KEY));
  } catch {
    return DEFAULT_DESKTOP_SUSPEND_POLICY;
  }
}

export function writeDesktopSuspendPolicy(
  policy: DesktopSuspendPolicy,
  storage: Pick<Storage, "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage
) {
  try {
    storage?.setItem(DESKTOP_SUSPEND_POLICY_STORAGE_KEY, parseDesktopSuspendPolicy(policy));
  } catch {
    // A denied local settings write must not affect world state or runtime behavior.
  }
}

export function getResumeCatchUpRequest(
  payload: DesktopResumeAfterSuspend,
  policy: DesktopSuspendPolicy
): DesktopResumeAfterSuspend {
  return getDesktopResumePolicyDecision(payload, policy).catchUpRequest;
}

export function getDesktopResumePolicyDecision(
  payload: DesktopResumeAfterSuspend,
  policy: DesktopSuspendPolicy
): DesktopResumePolicyDecision {
  if (policy === "CATCH_UP") {
    return { catchUpRequest: { ...payload }, pauseWorldAfterResume: false };
  }
  return {
    catchUpRequest: {
      ...payload,
      // PAUSE discards sleep elapsed time; runtime pause is applied separately
      // after the catch-up controller suppresses the wake-up foreground delta.
      wasRunning: false,
    },
    pauseWorldAfterResume: payload.wasRunning,
    notice: payload.wasRunning
      ? {
          title: "系统休眠恢复 · 世界已暂停",
          detail: "休眠期间未推进世界时间。点击工具栏 ▶ 继续世界。",
        }
      : {
          title: "系统已从休眠恢复，世界仍保持暂停。",
          detail: "休眠期间未推进世界时间。",
        },
  };
}
