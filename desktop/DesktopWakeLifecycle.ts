import type { EventEmitter } from "node:events";

export type DesktopWakeSource = "resume" | "unlock-screen" | "user-did-become-active" | "focus";
export interface DesktopWakeMessage { source: DesktopWakeSource; timestamp: number; sequence: number }

/** Main-process observations only. No elapsed-time/catch-up authority. */
export function installDesktopWakeLifecycle(
  power: Pick<EventEmitter, "on" | "removeListener">,
  send: (message: DesktopWakeMessage) => void,
  debug: boolean,
  initial: { onBattery?: boolean; thermalState?: string } = {},
  now = Date.now
) {
  const state = { lockCount: 0, ...initial } as {
    lockCount: number; lastLockScreenAt?: number; lastUnlockScreenAt?: number;
    lastUserActiveAt?: number; lastUserInactiveAt?: number; lastResumeAt?: number;
    lastFocusAt?: number; thermalState?: string; lastThermalStateChangeAt?: number;
    cpuSpeedLimitPercent?: number; lastSpeedLimitChangeAt?: number; onBattery?: boolean;
  };
  let sequence = 0;
  const listeners: Array<[string, (...args: any[]) => void]> = [];
  const wake = (source: DesktopWakeSource) => {
    const timestamp = now();
    if (debug) {
      if (source === "resume") state.lastResumeAt = timestamp;
      if (source === "unlock-screen") state.lastUnlockScreenAt = timestamp;
      if (source === "user-did-become-active") state.lastUserActiveAt = timestamp;
      if (source === "focus") state.lastFocusAt = timestamp;
    }
    if (source !== "focus" || debug) send({ source, timestamp, sequence: ++sequence });
  };
  const on = (event: string, callback: (...args: any[]) => void) => {
    listeners.push([event, callback]); power.on(event, callback);
  };
  for (const source of ["resume", "unlock-screen", "user-did-become-active"] as const) on(source, () => wake(source));
  if (debug) {
    on("lock-screen", () => { state.lockCount++; state.lastLockScreenAt = now(); });
    on("user-did-resign-active", () => { state.lastUserInactiveAt = now(); });
    on("thermal-state-change", (details) => { state.thermalState = details?.state; state.lastThermalStateChangeAt = now(); });
    on("speed-limit-change", (details) => { state.cpuSpeedLimitPercent = details?.limit; state.lastSpeedLimitChangeAt = now(); });
    on("on-battery", () => { state.onBattery = true; });
    on("on-ac", () => { state.onBattery = false; });
  }
  return { focus: () => wake("focus"), snapshot: () => debug ? { ...state } : undefined,
    dispose: () => { for (const [event, listener] of listeners) power.removeListener(event, listener); listeners.length = 0; } };
}
