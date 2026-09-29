import { describe, expect, it } from "vitest";
import SimulationDriver, {
  BASE_PLAY_RATE,
  MAX_BACKGROUND_REAL_MS,
  MAX_CATCH_UP_STEPS,
  SIMULATION_FIXED_STEP_MS,
  calculateBackgroundSimulationDebtMs,
} from "./SimulationDriver";

function context(speed = 1, running = true, basePlayRate = BASE_PLAY_RATE) {
  const deltas: number[] = [];
  return {
    deltas,
    ctx: {
      isRunning: () => running,
      getSpeed: () => speed,
      getBasePlayRate: () => basePlayRate,
      step: (fixedDeltaMs: number) => {
        deltas.push(fixedDeltaMs);
      },
    },
  };
}

describe("SimulationDriver", () => {
  it("uses a fixed-step accumulator for foreground frames", () => {
    const driver = new SimulationDriver();
    const { ctx, deltas } = context(1, true, 1);
    driver.updateForeground(SIMULATION_FIXED_STEP_MS / 2, ctx);
    expect(deltas).toHaveLength(0);
    driver.updateForeground(SIMULATION_FIXED_STEP_MS / 2, ctx);
    expect(deltas).toEqual([SIMULATION_FIXED_STEP_MS]);
  });

  it("uses base rate 2 while keeping 60Hz foreground frames below the step cap", () => {
    expect(BASE_PLAY_RATE).toBe(2);
    [1, 2, 4].forEach((speed) => {
      const driver = new SimulationDriver();
      const { ctx, deltas } = context(speed);
      const result = driver.updateForeground(1000 / 60, ctx);
      expect(result.steps).toBe(speed);
      expect(result.capped).toBe(false);
      expect(deltas).toEqual(Array(speed).fill(SIMULATION_FIXED_STEP_MS));
    });
  });

  it("maps selected 1x/2x/4x to effective 2x/4x/8x background debt", () => {
    const one = calculateBackgroundSimulationDebtMs({
      hiddenAtRealMs: 0,
      visibleAtRealMs: 10_000,
      speed: 1,
      wasPaused: false,
    });
    const two = calculateBackgroundSimulationDebtMs({
      hiddenAtRealMs: 0,
      visibleAtRealMs: 10_000,
      speed: 2,
      wasPaused: false,
    });
    const four = calculateBackgroundSimulationDebtMs({
      hiddenAtRealMs: 0,
      visibleAtRealMs: 10_000,
      speed: 4,
      wasPaused: false,
    });
    expect(one.simulationDebtMs).toBe(20_000);
    expect(two.simulationDebtMs).toBe(40_000);
    expect(four.simulationDebtMs).toBe(80_000);
  });

  it("makes varying frame deltas yield the same logical step count", () => {
    const a = new SimulationDriver();
    const b = new SimulationDriver();
    const ca = context(1, true, 1);
    const cb = context(1, true, 1);
    a.updateForeground(SIMULATION_FIXED_STEP_MS * 3, ca.ctx);
    b.updateForeground(SIMULATION_FIXED_STEP_MS, cb.ctx);
    b.updateForeground(SIMULATION_FIXED_STEP_MS, cb.ctx);
    b.updateForeground(SIMULATION_FIXED_STEP_MS, cb.ctx);
    expect(ca.deltas.length).toBe(cb.deltas.length);
  });

  it("caps foreground steps per frame and keeps remaining accumulator", () => {
    const driver = new SimulationDriver();
    const { ctx, deltas } = context(1, true, 1);
    const result = driver.updateForeground(SIMULATION_FIXED_STEP_MS * 10, ctx, 3);
    expect(deltas).toHaveLength(3);
    expect(result.capped).toBe(true);
    expect(driver.getAccumulatorMs()).toBeCloseTo(SIMULATION_FIXED_STEP_MS * 7);
  });

  it("does not advance while paused", () => {
    const driver = new SimulationDriver();
    const { ctx, deltas } = context(1, false);
    driver.updateForeground(SIMULATION_FIXED_STEP_MS * 5, ctx);
    expect(deltas).toHaveLength(0);
  });

  it("calculates background debt from hidden speed without advancing by itself", () => {
    expect(
      calculateBackgroundSimulationDebtMs({
        hiddenAtRealMs: 0,
        visibleAtRealMs: 10_000,
        speed: 1,
        basePlayRate: 1,
        wasPaused: false,
      }).simulationDebtMs
    ).toBe(10_000);
    expect(
      calculateBackgroundSimulationDebtMs({
        hiddenAtRealMs: 0,
        visibleAtRealMs: 10_000,
        speed: 2,
        basePlayRate: 1,
        wasPaused: false,
      }).simulationDebtMs
    ).toBe(20_000);
    expect(
      calculateBackgroundSimulationDebtMs({
        hiddenAtRealMs: 0,
        visibleAtRealMs: 10_000,
        speed: 4,
        basePlayRate: 1,
        wasPaused: false,
      }).simulationDebtMs
    ).toBe(40_000);
  });

  it("returns zero debt for paused hidden time", () => {
    const debt = calculateBackgroundSimulationDebtMs({
      hiddenAtRealMs: 0,
      visibleAtRealMs: 10 * 60 * 1000,
      speed: 4,
      basePlayRate: 1,
      wasPaused: true,
    });
    expect(debt.simulationDebtMs).toBe(0);
    expect(debt.shouldShowOverlay).toBe(false);
  });

  it("applies real-time and step caps to catch-up debt", () => {
    const realCapped = calculateBackgroundSimulationDebtMs({
      hiddenAtRealMs: 0,
      visibleAtRealMs: MAX_BACKGROUND_REAL_MS * 2,
      speed: 1,
      basePlayRate: 1,
      wasPaused: false,
    });
    expect(realCapped.cappedByRealTime).toBe(true);
    const stepCapped = calculateBackgroundSimulationDebtMs({
      hiddenAtRealMs: 0,
      visibleAtRealMs: 60 * 60 * 1000,
      speed: 4,
      basePlayRate: 1,
      wasPaused: false,
      maxRealMs: 60 * 60 * 1000,
      maxCatchUpSteps: 10,
    });
    expect(stepCapped.cappedBySteps).toBe(true);
    expect(stepCapped.simulationDebtMs).toBe(
      10 * SIMULATION_FIXED_STEP_MS
    );
    expect(MAX_CATCH_UP_STEPS).toBeGreaterThan(0);
  });

  it("can use the same driver step path for catch-up chunks in tests", () => {
    const driver = new SimulationDriver();
    const { ctx, deltas } = context(1, true, 1);
    driver.runCatchUpChunk(SIMULATION_FIXED_STEP_MS * 4, ctx, 2);
    expect(deltas).toHaveLength(2);
  });
});
