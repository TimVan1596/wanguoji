import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
const exposed = vi.hoisted(() => ({ bridge: undefined as any }));
const ipc = new EventEmitter();
vi.mock("electron", () => ({
  contextBridge: { exposeInMainWorld: (_name: string, bridge: unknown) => { exposed.bridge = bridge; } },
  ipcRenderer: { on: (channel: string, listener: (...args: any[]) => void) => ipc.on(channel, listener),
    removeListener: (channel: string, listener: (...args: any[]) => void) => ipc.removeListener(channel, listener) },
}));
it("exposes only allowlisted wake subscription and unregisters repeated mounts", async () => {
  await import("./preload");
  for (let i = 0; i < 50; i++) {
    const callback = vi.fn(); const unsubscribe = exposed.bridge.onDesktopWake(callback);
    ipc.emit("gridgod:desktop-wake", {}, { source: "resume", timestamp: 1, sequence: 1 });
    expect(callback).toHaveBeenCalledWith({ source: "resume", timestamp: 1, sequence: 1 });
    ipc.emit("arbitrary-channel", {}, {}); expect(callback).toHaveBeenCalledTimes(1);
    unsubscribe(); expect(ipc.listenerCount("gridgod:desktop-wake")).toBe(0);
  }
  expect(exposed.bridge).not.toHaveProperty("send"); expect(exposed.bridge).not.toHaveProperty("ipcRenderer");
  const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
  expect(main).toContain('mainWindow.webContents.send("gridgod:desktop-wake", message)');
  expect(main).toContain('installDesktopWakeLifecycle(powerMonitor');
  const bridge = readFileSync(new URL("../src/UI/DesktopLifecycleBridge.tsx", import.meta.url), "utf8");
  expect(bridge).toContain("Game.Core?.handleDesktopWake(message)");
  expect(bridge).toContain("unsubscribeWake?.()");
});

it("receives fixed main launch metadata before Game creation without exposing mutable Electron authority", async () => {
  const originalArgs = process.argv;
  try {
    for (const args of [[], ["--wanguoji-force-timeout-loop"], ["--wanguoji-debug"], ["--wanguoji-debug", "--wanguoji-force-timeout-loop"]]) {
      process.argv = args; vi.resetModules(); await import("./preload");
      expect(exposed.bridge.debugLaunchOptions).toEqual({ debug: args.includes("--wanguoji-debug"),
        forceTimeoutLoop: args.includes("--wanguoji-debug") && args.includes("--wanguoji-force-timeout-loop") });
      expect(Object.isFrozen(exposed.bridge.debugLaunchOptions)).toBe(true);
    }
  } finally { process.argv = originalArgs; }
});
