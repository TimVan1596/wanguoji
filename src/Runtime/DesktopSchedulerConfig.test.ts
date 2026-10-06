import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { withDesktopSchedulerConfig } from "./GameRuntimeConfig";
import { readPhaserLoop } from "./DesktopWakeRecovery";
import SimulationDriver from "../Simulation/SimulationDriver";
import WorldClock from "../Simulation/WorldClock";
import worldRandom from "../Simulation/WorldRandom";
import { createDeterminismCheckpoint } from "../Simulation/DeterminismFingerprint";
import { createEmptyWorldSaveV9 } from "../Persistence/WorldSaveSchema";
import { validateWorldSave } from "../Persistence/WorldSaveValidator";

const require = createRequire(import.meta.url);
const TimeStep = require("phaser/src/core/TimeStep.js");
afterEach(() => { vi.unstubAllGlobals(); });
const bridge = (debug: boolean, forceTimeoutLoop: boolean) => ({ isDesktop: true as const, debugLaunchOptions: { debug, forceTimeoutLoop } });

describe("Phaser scheduler selection before Game creation", () => {
  it("preserves Web/default/release config and every existing field; only explicit Desktop debug forces timeout", () => {
    const config = { fps: { target: 75, min: 10, smoothStep: false, panicMax: 30, forceSetTimeOut: false }, audio: { noAudio: true } };
    expect(withDesktopSchedulerConfig(config)).toBe(config);
    expect(withDesktopSchedulerConfig(config, { isDesktop: true })).toBe(config);
    expect(withDesktopSchedulerConfig(config, bridge(false, true))).toBe(config);
    expect(withDesktopSchedulerConfig(config, bridge(true, false))).toBe(config);
    const changed = withDesktopSchedulerConfig(config, bridge(true, true));
    expect(changed.fps).toEqual({ ...config.fps, forceSetTimeOut: true });
    expect(changed.audio).toBe(config.audio); expect(config.fps.forceSetTimeOut).toBe(false);
    expect(withDesktopSchedulerConfig({}, bridge(true, true)).fps).toEqual({ target: 60, forceSetTimeOut: true });
    const gameCard = readFileSync(new URL("../UI/Components/GameCard.tsx", import.meta.url), "utf8");
    expect(gameCard).toContain("new Game(withDesktopSchedulerConfig({");
    expect(gameCard).toContain("}, window.gridGodDesktop)");
    expect(gameCard).not.toMatch(/forceSetTimeOut\s*=/);
  });
  it("installed Phaser initializes RAF or timeout through its own runner; identical callback inputs preserve canonical state/RNG", () => {
    const run = (forceTimeoutLoop: boolean) => {
      let time = 0;
      const raf = vi.fn(() => 1), timeout = vi.fn(() => 2);
      vi.stubGlobal("window", { performance: { now: () => time }, requestAnimationFrame: raf, setTimeout: timeout });
      const config = withDesktopSchedulerConfig({}, bridge(true, forceTimeoutLoop));
      const loop = new TimeStep({}, config.fps ?? {});
      worldRandom.initialize("scheduler-ab"); const clock = new WorldClock(); clock.setRunning(true);
      const driver = new SimulationDriver(); let steps = 0;
      const context = { isRunning: () => true, getSpeed: () => 4, step: (delta: number) => { clock.update(delta); worldRandom.next(); steps++; } };
      loop.start((_time: number, delta: number) => driver.updateForeground(delta, context));
      expect(loop.raf.isSetTimeOut).toBe(forceTimeoutLoop);
      expect(readPhaserLoop(loop).frameScheduler).toBe(forceTimeoutLoop ? "SET_TIMEOUT" : "RAF");
      expect(forceTimeoutLoop ? timeout : raf).toHaveBeenCalledTimes(1);
      expect(forceTimeoutLoop ? raf : timeout).not.toHaveBeenCalled();
      // Structural runner boundary, not a real Electron cadence/visual acceptance test.
      for (let i = 0; i < 600; i++) { time += i % 100 === 99 ? 250 : 1000 / 60; loop.raf.callback(time); }
      const save = createEmptyWorldSaveV9(); save.world.clock = clock.exportState(); save.world.worldMonth = clock.worldMonth;
      save.world.running = true; save.world.simulationDriver = driver.exportState(); save.worldRandom = worldRandom.exportState();
      expect(validateWorldSave(save).valid).toBe(true); expect(JSON.parse(JSON.stringify(save))).toEqual(save);
      return { steps, save, digest: createDeterminismCheckpoint({ worldMonth: clock.worldMonth, random: worldRandom.exportState(), factions: [], cities: [], territory: [] }) };
    };
    expect(run(false)).toEqual(run(true));
  });
});
