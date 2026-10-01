import type Core from "../Game/Core";
import type { ManualSaveResult } from "./WorldSaveWorkflow";
import { isWorldSaveInFlight, waitForWorldSaveIdle, WorldSaveBusyError } from "./WorldSaveWorkflow";
import { store } from "../store";

export type ActiveWorldSaveReason =
  | "NO_WORLD"
  | "RUNTIME_INITIALIZING"
  | "RUNTIME_UNAVAILABLE"
  | "SAVE_BUSY"
  | "CATCHING_UP"
  | "HYDRATION"
  | "SNAPSHOT"
  | "SAVE_FAILED";

export type ActiveWorldSaveResult =
  | { status: "SAVED"; result: ManualSaveResult }
  | { status: "SKIPPED"; reason: "NO_WORLD" }
  | { status: "FAILED"; reason: ActiveWorldSaveReason; error?: string };

export interface ActiveWorldPersistenceAuthority {
  isWorldStarted(): boolean;
  getCore(): Core | undefined;
  save(core: Core): Promise<ManualSaveResult>;
}

let authority: ActiveWorldPersistenceAuthority | undefined;

export function registerActiveWorldPersistence(next: ActiveWorldPersistenceAuthority) {
  authority = next;
  return () => {
    if (authority === next) authority = undefined;
  };
}

export function getActiveWorldPersistenceState() {
  const worldStarted = authority?.isWorldStarted() ?? store.getState().root.worldStarted;
  if (!worldStarted) return "NO_WORLD" as const;
  if (!authority) return "RUNTIME_INITIALIZING" as const;
  let core: Core | undefined;
  try {
    core = authority.getCore();
  } catch {
    return "RUNTIME_UNAVAILABLE" as const;
  }
  if (!core) return "RUNTIME_UNAVAILABLE" as const;
  if (isWorldSaveInFlight()) return "SAVE_BUSY" as const;
  const block = core.getDesktopSaveBlockReason();
  if (block === "NO_WORLD") return "RUNTIME_INITIALIZING" as const;
  if (block === "CATCH_UP") return "CATCHING_UP" as const;
  if (block === "HYDRATION") return "HYDRATION" as const;
  if (block === "SNAPSHOT") return "SNAPSHOT" as const;
  return "READY" as const;
}

export async function saveActiveWorld(options: { waitForBusy?: boolean; timeoutMs?: number } = {}): Promise<ActiveWorldSaveResult> {
  const deadline = Date.now() + (options.timeoutMs ?? 10_000);
  while (true) {
    const state = getActiveWorldPersistenceState();
    if (state === "NO_WORLD") return { status: "SKIPPED", reason: "NO_WORLD" };
    if (state !== "READY" && state !== "SAVE_BUSY") {
      return { status: "FAILED", reason: state, error: `当前保存状态不可用：${state}` };
    }
    if (state === "SAVE_BUSY") {
      if (!options.waitForBusy) return { status: "FAILED", reason: "SAVE_BUSY", error: "保存任务仍在进行" };
      const remaining = deadline - Date.now();
      if (remaining <= 0 || !(await waitForWorldSaveIdle(remaining))) {
        return { status: "FAILED", reason: "SAVE_BUSY", error: "等待现有保存任务超时" };
      }
      continue;
    }

    const current = authority;
    let core: Core | undefined;
    if (!current) return { status: "FAILED", reason: "RUNTIME_INITIALIZING" };
    try {
      core = current.getCore();
    } catch {
      return { status: "FAILED", reason: "RUNTIME_UNAVAILABLE", error: "无法访问当前游戏运行时" };
    }
    if (!core) return { status: "FAILED", reason: "RUNTIME_UNAVAILABLE" };
    try {
      return { status: "SAVED", result: await current.save(core) };
    } catch (error) {
      if (error instanceof WorldSaveBusyError && options.waitForBusy && Date.now() < deadline) continue;
      const reason = error instanceof WorldSaveBusyError ? "SAVE_BUSY" : "SAVE_FAILED";
      return { status: "FAILED", reason, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
