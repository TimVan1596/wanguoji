import type { DesktopResumeAfterSuspend } from "./DesktopRuntime";

export type DesktopSuspendPolicy = "PAUSE" | "CATCH_UP";

export const DESKTOP_SUSPEND_POLICY_STORAGE_KEY = "wanguoji.desktopSuspendPolicy";
export const DEFAULT_DESKTOP_SUSPEND_POLICY: DesktopSuspendPolicy = "PAUSE";

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
  return {
    ...payload,
    // PAUSE discards sleep elapsed time while leaving the live simulator's
    // running state and selected speed untouched.
    wasRunning: policy === "CATCH_UP" && payload.wasRunning,
  };
}
