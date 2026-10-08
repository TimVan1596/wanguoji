import { describe, expect, it } from "vitest";
import SimulationDriver, { BASE_PLAY_RATE, MAX_FOREGROUND_STEPS_PER_FRAME, SIMULATION_FIXED_STEP_MS as STEP } from "./SimulationDriver";
import { ForegroundDebtDiagnostics } from "./ForegroundDebtDiagnostics";
import WorldClock from "./WorldClock";
import worldRandom from "./WorldRandom";
import { createDeterminismCheckpoint } from "./DeterminismFingerprint";
import { createEmptyWorldSaveV9 } from "../Persistence/WorldSaveSchema";
import { validateWorldSave } from "../Persistence/WorldSaveValidator";

const ctx = { isRunning: () => true, getSpeed: () => 4, step: () => {} };
// Arithmetic-only reference of f517297 foreground accumulation, not a second world simulator.
class LegacyAccumulator {
  accumulator = 0;
  update(delta: number, speed = 4) {
    this.accumulator += delta * BASE_PLAY_RATE * speed;
    let steps = 0;
    while (this.accumulator + 1e-6 >= STEP && steps < 16) { this.accumulator = Math.max(0, this.accumulator - STEP); steps++; }
    return steps;
  }
}

describe("bounded foreground debt recovery", () => {
  it.each([1, 2, 4])("preserves normal long-run 60FPS speed%i pacing and fractional carry", speed => {
    const driver = new SimulationDriver(); const old = new LegacyAccumulator();
    let total = 0;
    for (let i = 0; i < 6000; i++) {
      const result = driver.updateForeground(1000 / 60, { ...ctx, getSpeed: () => speed });
      expect(result.steps).toBe(old.update(1000 / 60, speed));
      expect(result.droppedDebtMs).toBe(0);
      expect(result.stepCapHit).toBe(false);
      expect(result.accumulatorMs).toBeCloseTo(old.accumulator, 6);
      total += result.steps;
    }
    expect(total).toBe(speed * 6000);
    driver.reset();
    for (let i = 0; i < 300; i++) expect(driver.updateForeground(16.67, { ...ctx, getSpeed: () => speed }).accumulatorMs).toBeLessThan(STEP);
  });

  it.each([250, 500, 1000, 5000])("%ims stall leaves old debt; new pacing recovers on the next normal frame", stall => {
    const driver = new SimulationDriver(); const old = new LegacyAccumulator();
    for (let i = 0; i < 60; i++) { driver.updateForeground(1000 / 60, ctx); old.update(1000 / 60); }
    const spike = driver.updateForeground(stall, ctx); old.update(stall);
    expect(old.accumulator).toBeGreaterThan(STEP);
    expect(spike.steps).toBe(MAX_FOREGROUND_STEPS_PER_FRAME);
    expect(spike.stepCapHit).toBe(true); expect(spike.droppedDebtMs).toBeGreaterThan(0);
    expect(spike.accumulatorMs).toBeLessThan(STEP);
    for (let i = 0; i < 60; i++) expect(driver.updateForeground(1000 / 60, ctx).steps).toBe(4);
  });

  it("reproduces old persistent debt and recovers immediately after throttled frames", () => {
    const old = new LegacyAccumulator(); const driver = new SimulationDriver();
    for (let i = 0; i < 50; i++) { old.update(100); driver.updateForeground(100, ctx); }
    const oldDebt = old.accumulator;
    expect(oldDebt).toBeGreaterThan(13000);
    for (let i = 0; i < 600; i++) { expect(old.update(1000 / 15)).toBe(16); driver.updateForeground(1000 / 15, ctx); }
    expect(old.accumulator).toBeCloseTo(oldDebt, 5);
    expect(driver.getAccumulatorMs()).toBeLessThan(STEP);
    for (let i = 0; i < 120; i++) expect(driver.updateForeground(1000 / 60, ctx).steps).toBe(4);
  });

  it("repeated spikes never retain whole-step debt and retain an existing fractional phase", () => {
    const driver = new SimulationDriver();
    for (let i = 0; i < 2000; i++) {
      const result = driver.updateForeground(i % 10 === 0 ? 100 + i % 401 : 1000 / 60, ctx);
      expect(result.accumulatorMs).toBeLessThan(STEP);
      expect(result.steps).toBeLessThanOrEqual(16);
    }
    driver.importState({ accumulatorMs: STEP / 4 });
    const result = driver.updateForeground(500, ctx);
    expect(result.accumulatorMs).toBeCloseTo(STEP / 4, 6);
    expect(driver.updateForeground(1000 / 60, ctx).steps).toBe(4);
  });

  it("background chunk debt is preserved; snapshot stop-and-discard discards all uncommitted time", () => {
    const driver = new SimulationDriver();
    const catchUp = driver.runCatchUpChunk(STEP * 100, ctx, 16);
    expect(catchUp.remainingDebtMs).toBeCloseTo(STEP * 84);
    expect(catchUp.complete).toBe(false);
    driver.reset();
    const stopped = driver.updateForeground(5000, { ...ctx, step: () => "stop-and-discard" });
    expect(stopped).toMatchObject({ steps: 1, stopped: true, accumulatorMs: 0, droppedDebtMs: 0, stepCapHit: false });
    driver.importState({ accumulatorMs: STEP * 500 });
    const result = driver.updateForeground(1000 / 60, ctx);
    expect(result.accumulatorMs).toBeLessThan(STEP); // Legacy V9 transient backlog is bounded on first running frame.
    expect(result.droppedDebtMs).toBeGreaterThan(0);
  });

  it("debug on/off executes identical fixed steps, canonical clock/digest/RNG and V9 continuation", () => {
    const run = (debug: boolean, hydrate = true) => {
      worldRandom.initialize("foreground-debt-recovery");
      const driver = new SimulationDriver(); const clock = new WorldClock(); clock.setRunning(true);
      const diagnostics = new ForegroundDebtDiagnostics(debug);
      let executedSteps = 0;
      const context = { ...ctx, step: (delta: number) => { clock.update(delta); worldRandom.next(); executedSteps++; } };
      const deltas = Array.from({ length: 300 }, (_, i) => i % 33 === 0 ? 500 : 1000 / 60);
      const advance = (delta: number) => {
        const result = driver.updateForeground(delta, context);
        diagnostics.record(delta, delta, result, () => ({ worldMonth: clock.worldMonth, visibility: "visible", focused: true, savePhase: "idle" }));
      };
      deltas.forEach(advance);
      const save = createEmptyWorldSaveV9();
      save.world.worldMonth = clock.worldMonth; save.world.clock = clock.exportState(); save.world.running = true;
      save.world.simulationDriver = driver.exportState(); save.worldRandom = worldRandom.exportState();
      expect(validateWorldSave(save).valid).toBe(true);
      const restored = JSON.parse(JSON.stringify(save)) as typeof save;
      expect(restored).toMatchObject({ saveSchemaVersion: 12, world: { simulationDriver: driver.exportState() }, worldRandom: worldRandom.exportState() });
      if (hydrate) { driver.importState(restored.world.simulationDriver); clock.importState(restored.world.clock); worldRandom.restore(restored.worldRandom); }
      deltas.forEach(advance);
      const random = worldRandom.exportState();
      return { executedSteps, clock: clock.exportState(), driver: driver.exportState(), random,
        checkpoint: createDeterminismCheckpoint({ worldMonth: clock.worldMonth, random, factions: [], cities: [], territory: [] }) };
    };
    expect(run(true)).toEqual(run(false));
    expect(run(false, true)).toEqual(run(false, false));
  });
});
