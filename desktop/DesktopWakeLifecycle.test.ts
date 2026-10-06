import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { installDesktopWakeLifecycle, type DesktopWakeMessage } from "./DesktopWakeLifecycle";

describe("desktop wake lifecycle", () => {
  it("wires OS events, forwards only wake sources and keeps bounded power observations", () => {
    const power = new EventEmitter(); const messages: DesktopWakeMessage[] = []; let time = 100;
    const lifecycle = installDesktopWakeLifecycle(power, message => messages.push(message), true, { onBattery: false, thermalState: "nominal" }, () => ++time);
    power.emit("lock-screen"); power.emit("unlock-screen"); power.emit("user-did-resign-active");
    power.emit("user-did-become-active"); power.emit("resume"); lifecycle.focus();
    power.emit("thermal-state-change", { state: "serious" }); power.emit("speed-limit-change", { limit: 60 }); power.emit("on-battery");
    expect(messages.map(message => message.source)).toEqual(["unlock-screen", "user-did-become-active", "resume", "focus"]);
    expect(messages.map(message => message.sequence)).toEqual([1, 2, 3, 4]);
    expect(lifecycle.snapshot()).toMatchObject({ lockCount: 1, lastLockScreenAt: 101, lastUnlockScreenAt: 102,
      lastUserInactiveAt: 103, lastUserActiveAt: 104, lastResumeAt: 105, lastFocusAt: 106,
      thermalState: "serious", lastThermalStateChangeAt: 107, cpuSpeedLimitPercent: 60, lastSpeedLimitChangeAt: 108, onBattery: true });
    power.emit("on-ac"); expect(lifecycle.snapshot()?.onBattery).toBe(false);
    for (let i = 0; i < 1000; i++) power.emit("lock-screen");
    expect(lifecycle.snapshot()?.lockCount).toBe(1001);
    lifecycle.dispose(); lifecycle.dispose();
    expect(power.eventNames()).toEqual([]);
    installDesktopWakeLifecycle(power, () => {}, true).dispose(); expect(power.eventNames()).toEqual([]);
  });
  it("release registers only required wake recovery; no diagnostic events or polling", () => {
    const power = new EventEmitter(); const messages: DesktopWakeMessage[] = [];
    const lifecycle = installDesktopWakeLifecycle(power, message => messages.push(message), false);
    expect(power.eventNames()).toEqual(["resume", "unlock-screen", "user-did-become-active"]);
    lifecycle.focus(); power.emit("lock-screen"); power.emit("resume");
    expect(messages.map(message => message.source)).toEqual(["resume"]);
    expect(lifecycle.snapshot()).toBeUndefined(); lifecycle.dispose();
  });
});
