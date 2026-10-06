import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopWakeRecovery, readPhaserLoop } from "./DesktopWakeRecovery";
import SimulationDriver from "../Simulation/SimulationDriver";
import WorldClock from "../Simulation/WorldClock";
import worldRandom from "../Simulation/WorldRandom";
import { createEmptyWorldSaveV9 } from "../Persistence/WorldSaveSchema";
import { validateWorldSave } from "../Persistence/WorldSaveValidator";
import { createDeterminismCheckpoint } from "../Simulation/DeterminismFingerprint";

const require = createRequire(import.meta.url);
const TimeStep = require("phaser/src/core/TimeStep.js");
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const message = (sequence = 1) => ({ source: "unlock-screen" as const, sequence, timestamp: 10000 + sequence });

describe("Phaser desktop wake boundary", () => {
  it("uses installed Phaser resetDelta with its receiver; no loop restart or fake fields", () => {
    vi.stubGlobal("window", { performance: { now: () => 12345 } });
    const loop = new TimeStep({}, { target: 60 });
    loop.raf.start = () => {}; loop.start(() => {});
    loop.lastTime = 1; loop.delta = 5000; loop.deltaHistory.fill(5000);
    const recovery = new DesktopWakeRecovery(true, () => 0);
    recovery.wake(message(), loop);
    expect(loop.lastTime).toBe(12345); expect(loop.delta).toBe(0);
    expect(loop.deltaHistory.every((delta: number) => delta <= 1000 / 60)).toBe(true);
    expect(loop._coolDown).toBe(loop.panicMax);
    expect(loop.running).toBe(true); expect(loop.raf.isRunning).toBe(false);
    expect(recovery.snapshot(loop)?.incidents[0].before.delta).toBe(5000);
    expect(readPhaserLoop({})).toMatchObject({ coolDown: undefined, actualFps: undefined, raf: { isRunning: undefined } });
    recovery.wake({ ...message(2), source: "focus" }, loop);
    expect(recovery.snapshot(loop)?.incidents[1].resetApplied).toBe(false);
  });
  it("deduplicates repeated IPC, rejects invalid messages and bounds wake/frame observations", () => {
    let time = 0; vi.spyOn(Date, "now").mockImplementation(() => 10001 + time);
    const resetDelta = vi.fn(); const loop = { resetDelta, rawDelta: 132, delta: 16, actualFps: 7.5 };
    const recovery = new DesktopWakeRecovery(true, () => time);
    recovery.wake(message(), loop); recovery.wake(message(), loop);
    recovery.wake({ ...message(2), source: "arbitrary-channel" }, loop);
    recovery.wake({ ...message(2), timestamp: NaN }, loop);
    expect(resetDelta).toHaveBeenCalledTimes(1);
    time = 1100; recovery.frame(loop);
    time = 5100; recovery.frame(loop);
    time = 10100; loop.rawDelta = 16; recovery.frame(loop);
    const snapshot = recovery.snapshot(loop)!;
    expect(snapshot.incidents[0].samples.map(sample => sample.thresholdSeconds)).toEqual([1, 5, 10]);
    expect(snapshot.incidents[0].firstNormalFrameLatencyMs).toBe(10100);
    expect(snapshot.incidents[0].samples[0].observedCallbackFps).toBeCloseTo(1000 / 1100);
    expect(snapshot.pendingObservations).toBe(0);
    snapshot.incidents[0].samples[0].loop.delta = -1;
    expect(recovery.snapshot(loop)!.incidents[0].samples[0].loop.delta).toBe(16);
    for (let i = 2; i <= 100; i++) recovery.wake(message(i), loop);
    expect(recovery.snapshot(loop)?.incidents).toHaveLength(20);
    expect(recovery.snapshot(loop)?.pendingObservations).toBe(20);
  });
  it("reports late first-normal recovery after the 10s samples; expires unresolved observations at 60s", () => {
    let time = 0; vi.spyOn(Date, "now").mockImplementation(() => 10001 + time);
    const recovery = new DesktopWakeRecovery(true, () => time);
    const loop = { resetDelta: () => {}, rawDelta: 132 };
    recovery.wake(message(), loop);
    for (time = 132; time < 15000; time += 132) recovery.frame(loop);
    expect(recovery.snapshot(loop)?.incidents[0].samples).toHaveLength(3);
    expect(recovery.snapshot(loop)?.pendingObservations).toBe(1);
    loop.rawDelta = 16; recovery.frame(loop);
    expect(recovery.snapshot(loop)?.incidents[0].firstNormalFrameLatencyMs).toBe(time);
    expect(recovery.snapshot(loop)?.pendingObservations).toBe(0);
    recovery.wake(message(2), loop); loop.rawDelta = 132;
    time += 1000; recovery.frame(loop); time += 5000; recovery.frame(loop);
    time += 10000; recovery.frame(loop); time += 60000; recovery.frame(loop);
    expect(recovery.snapshot(loop)?.incidents[1].normalFrameObservationExpired).toBe(true);
    expect(recovery.snapshot(loop)?.pendingObservations).toBe(0);
  });
  it("debug off adds no loop reads, frame sampling, timers or diagnostic clock calls", () => {
    const now = vi.fn(() => 0); const resetDelta = vi.fn();
    const loop = { resetDelta, get rawDelta(): number { throw new Error("diagnostic read"); } };
    const recovery = new DesktopWakeRecovery(false, now);
    recovery.wake(message(), loop); recovery.frame(loop);
    expect(recovery.snapshot(loop)).toBeUndefined(); expect(now).not.toHaveBeenCalled();
    expect(resetDelta).toHaveBeenCalledTimes(1);
  });
  it("wake itself never changes V9, WorldClock, fractional carry or RNG; debug executed-step digests match", () => {
    const run = (debug: boolean) => {
      worldRandom.initialize("wake-boundary");
      const clock = new WorldClock(); clock.setRunning(true); const driver = new SimulationDriver();
      driver.importState({ accumulatorMs: 8 });
      const recovery = new DesktopWakeRecovery(debug, () => 0); const loop = { resetDelta: vi.fn(), rawDelta: 16 };
      const context = { isRunning: () => true, getSpeed: () => 4,
        step: (delta: number) => { clock.update(delta); worldRandom.next(); } };
      const save = () => { const dto = createEmptyWorldSaveV9(); dto.world.clock = clock.exportState(); dto.world.worldMonth = clock.worldMonth;
        dto.world.running = true; dto.world.simulationDriver = driver.exportState(); dto.worldRandom = worldRandom.exportState(); return dto; };
      const before = JSON.stringify(save());
      for (let i = 1; i <= 100; i++) recovery.wake(message(i), loop);
      expect(JSON.stringify(save())).toBe(before); expect(driver.getAccumulatorMs()).toBe(8);
      for (let i = 0; i < 100; i++) { driver.updateForeground(1000 / 60, context); recovery.frame(loop); }
      const dto = save(); expect(validateWorldSave(dto).valid).toBe(true);
      expect(JSON.parse(JSON.stringify(dto))).toEqual(dto);
      return { dto, digest: createDeterminismCheckpoint({ worldMonth: clock.worldMonth, random: worldRandom.exportState(), factions: [], cities: [], territory: [] }) };
    };
    expect(run(true)).toEqual(run(false));
  });
});
