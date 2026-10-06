import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { DesktopAppSuspensionBlocker } from "./DesktopAppSuspensionBlocker";
import { getDesktopDebugLaunchOptions, getDesktopPreloadArguments } from "./DesktopRendererUrl";

function fakeApi() {
  const active = new Set<number>();
  return { start: vi.fn((_type: "prevent-app-suspension") => { active.add(0); return 0; }),
    isStarted: vi.fn((id: number) => active.has(id)), stop: vi.fn((id: number) => active.delete(id)) };
}
describe("debug-only lock-screen A/B launch and blocker ownership", () => {
  it.each([[], ["--wanguoji-debug"], ["--wanguoji-prevent-app-suspension"], ["--wanguoji-force-timeout-loop"]].map(args => ({ args })))
    ("default/release args %j do not enable either experiment", ({ args }) => {
      const options = getDesktopDebugLaunchOptions(args);
      expect(options.preventAppSuspension).toBe(false); expect(options.forceTimeoutLoop).toBe(false);
      const api = fakeApi(); const blocker = new DesktopAppSuspensionBlocker(api, options.preventAppSuspension);
      blocker.start(); blocker.stop();
      expect(api.start).not.toHaveBeenCalled(); expect(api.stop).not.toHaveBeenCalled();
      expect(blocker.snapshot()).toMatchObject({ status: "OFF", isStarted: false, requested: false });
    });
  it("supports independent B/C and optional combined experiments; sandbox arguments are allowlisted", () => {
    const b = getDesktopDebugLaunchOptions(["--wanguoji-debug", "--wanguoji-prevent-app-suspension"]);
    const c = getDesktopDebugLaunchOptions(["--wanguoji-debug", "--wanguoji-force-timeout-loop"]);
    expect(b).toMatchObject({ debug: true, preventAppSuspension: true, forceTimeoutLoop: false });
    expect(c).toMatchObject({ debug: true, preventAppSuspension: false, forceTimeoutLoop: true });
    expect(getDesktopPreloadArguments(b)).toEqual(["--wanguoji-debug"]);
    expect(getDesktopPreloadArguments(c)).toEqual(["--wanguoji-debug", "--wanguoji-force-timeout-loop"]);
    const both = getDesktopDebugLaunchOptions(["--wanguoji-debug", "--wanguoji-force-timeout-loop", "--wanguoji-prevent-app-suspension", "--untrusted"]);
    expect(both).toMatchObject({ preventAppSuspension: true, forceTimeoutLoop: true });
    expect(getDesktopPreloadArguments(both)).not.toContain("--untrusted");
    expect(getDesktopPreloadArguments(getDesktopDebugLaunchOptions(["--wanguoji-force-timeout-loop"]))).toEqual([]);
  });
  it("starts one prevent-app-suspension resource, including id0, and stops once at shutdown", () => {
    const api = fakeApi(); const blocker = new DesktopAppSuspensionBlocker(api, true);
    for (let i = 0; i < 100; i++) blocker.start();
    expect(api.start).toHaveBeenCalledTimes(1); expect(api.start).toHaveBeenCalledWith("prevent-app-suspension");
    expect(blocker.snapshot()).toMatchObject({ id: 0, isStarted: true, status: "ON / prevent-app-suspension" });
    expect(blocker.snapshot().startReason).toContain("explicit");
    blocker.stop(); blocker.stop(); blocker.start();
    expect(api.stop).toHaveBeenCalledTimes(1); expect(api.stop).toHaveBeenCalledWith(0);
    expect(api.start).toHaveBeenCalledTimes(1); expect(blocker.snapshot().status).toBe("OFF");
  });
  it("reports failed startup as OFF instead of claiming ON", () => {
    const api = fakeApi(); api.start.mockImplementation(() => { throw new Error("not available"); });
    const blocker = new DesktopAppSuspensionBlocker(api, true); blocker.start();
    expect(blocker.snapshot()).toMatchObject({ status: "OFF", isStarted: false, error: "not available" });
  });
  it("main owns a single blocker and releases it only on actual app shutdown; scripts isolate B/C", () => {
    const main = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
    expect(main.match(/new DesktopAppSuspensionBlocker/g)).toHaveLength(1);
    expect(main).toContain('app.once("will-quit", () => appSuspensionBlocker.stop())');
    expect(main).toContain("additionalArguments: getDesktopPreloadArguments(debugLaunchOptions)");
    expect(main).not.toContain("prevent-display-sleep");
    const scripts = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).scripts;
    expect(scripts["desktop:start:debug:blocker"]).toContain("--wanguoji-prevent-app-suspension");
    expect(scripts["desktop:start:debug:blocker"]).not.toContain("--wanguoji-force-timeout-loop");
    expect(scripts["desktop:start:debug:timeout"]).toContain("--wanguoji-force-timeout-loop");
    expect(scripts["desktop:start:debug:timeout"]).not.toContain("--wanguoji-prevent-app-suspension");
    for (const script of ["desktop:start", "desktop:start:debug"]) {
      expect(scripts[script]).not.toMatch(/--wanguoji-(prevent-app-suspension|force-timeout-loop)/);
    }
  });
});
