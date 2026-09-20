import { WORLD_MONTH_MS } from "../config/simulation";

export const SIMULATION_FIXED_STEP_MS = 1000 / 30;
export const BASE_PLAY_RATE = 1.5;
export const MAX_FOREGROUND_STEPS_PER_FRAME = 16;
export const MAX_BACKGROUND_REAL_MS = 2 * 60 * 60 * 1000;
export const MAX_CATCH_UP_WORLD_MONTHS = 1000 * 12;
export const MAX_CATCH_UP_STEPS = Math.floor(
  (MAX_CATCH_UP_WORLD_MONTHS * WORLD_MONTH_MS) / SIMULATION_FIXED_STEP_MS
);
export const SHORT_BACKGROUND_REAL_MS = 1500;
const STEP_EPSILON_MS = 1e-6;

export interface SimulationStepContext {
  isRunning: () => boolean;
  getSpeed: () => number;
  getBasePlayRate?: () => number;
  step: (fixedDeltaMs: number) => void;
}

export interface ForegroundStepResult {
  steps: number;
  accumulatorMs: number;
  capped: boolean;
}

export interface CatchUpStepResult {
  steps: number;
  remainingDebtMs: number;
  complete: boolean;
}

export default class SimulationDriver {
  private accumulatorMs = 0;

  reset() {
    this.accumulatorMs = 0;
  }

  updateForeground(
    realDeltaMs: number,
    context: SimulationStepContext,
    maxSteps = MAX_FOREGROUND_STEPS_PER_FRAME
  ): ForegroundStepResult {
    if (!context.isRunning()) {
      return {
        steps: 0,
        accumulatorMs: this.accumulatorMs,
        capped: false,
      };
    }
    this.accumulatorMs +=
      Math.max(0, realDeltaMs) *
      sanitizeBasePlayRate(context.getBasePlayRate?.() ?? BASE_PLAY_RATE) *
      sanitizeSpeed(context.getSpeed());
    const result = this.consumeAccumulator(context, maxSteps);
    return result;
  }

  runCatchUpChunk(
    debtMs: number,
    context: SimulationStepContext,
    maxSteps: number
  ): CatchUpStepResult {
    if (!context.isRunning() || debtMs <= 0 || maxSteps <= 0) {
      return {
        steps: 0,
        remainingDebtMs: Math.max(0, debtMs),
        complete: debtMs <= 0,
      };
    }
    this.accumulatorMs += debtMs;
    const { steps } = this.consumeAccumulator(context, maxSteps);
    return {
      steps,
      remainingDebtMs: this.accumulatorMs,
      complete: this.accumulatorMs < SIMULATION_FIXED_STEP_MS,
    };
  }

  getAccumulatorMs() {
    return this.accumulatorMs;
  }

  private consumeAccumulator(
    context: SimulationStepContext,
    maxSteps: number
  ): ForegroundStepResult {
    let steps = 0;
    while (
      this.accumulatorMs + STEP_EPSILON_MS >= SIMULATION_FIXED_STEP_MS &&
      steps < maxSteps
    ) {
      context.step(SIMULATION_FIXED_STEP_MS);
      this.accumulatorMs = Math.max(
        0,
        this.accumulatorMs - SIMULATION_FIXED_STEP_MS
      );
      steps += 1;
    }
    return {
      steps,
      accumulatorMs: this.accumulatorMs,
      capped: this.accumulatorMs >= SIMULATION_FIXED_STEP_MS,
    };
  }
}

export function calculateBackgroundSimulationDebtMs({
  hiddenAtRealMs,
  visibleAtRealMs,
  speed,
  basePlayRate = BASE_PLAY_RATE,
  wasPaused,
  maxRealMs = MAX_BACKGROUND_REAL_MS,
  maxCatchUpSteps = MAX_CATCH_UP_STEPS,
}: {
  hiddenAtRealMs: number;
  visibleAtRealMs: number;
  speed: number;
  basePlayRate?: number;
  wasPaused: boolean;
  maxRealMs?: number;
  maxCatchUpSteps?: number;
}) {
  if (wasPaused) {
    return {
      realElapsedMs: Math.max(0, visibleAtRealMs - hiddenAtRealMs),
      cappedRealElapsedMs: 0,
      simulationDebtMs: 0,
      cappedByRealTime: false,
      cappedBySteps: false,
      shouldShowOverlay: false,
    };
  }
  const realElapsedMs = Math.max(0, visibleAtRealMs - hiddenAtRealMs);
  const cappedRealElapsedMs = Math.min(realElapsedMs, maxRealMs);
  const rawDebtMs =
    cappedRealElapsedMs * sanitizeBasePlayRate(basePlayRate) * sanitizeSpeed(speed);
  const maxDebtMs = Math.max(0, maxCatchUpSteps) * SIMULATION_FIXED_STEP_MS;
  const simulationDebtMs = Math.min(rawDebtMs, maxDebtMs);
  return {
    realElapsedMs,
    cappedRealElapsedMs,
    simulationDebtMs,
    cappedByRealTime: realElapsedMs > cappedRealElapsedMs,
    cappedBySteps: rawDebtMs > simulationDebtMs,
    shouldShowOverlay: realElapsedMs >= SHORT_BACKGROUND_REAL_MS && simulationDebtMs > 0,
  };
}

function sanitizeSpeed(speed: number) {
  return Math.max(1, Math.min(4, speed || 1));
}

function sanitizeBasePlayRate(rate: number) {
  return Math.max(0.1, Math.min(8, rate || 1));
}
