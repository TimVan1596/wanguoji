import { SIMULATION_FIXED_STEP_MS, type ForegroundStepResult } from "./SimulationDriver";

export interface ForegroundDebtContext {
  worldMonth: number;
  focused?: boolean;
  visibility: string;
  minimized?: boolean;
  minimizedObservedAt?: number;
  savePhase: string;
  rightPanelTab?: string;
}
export interface ForegroundDebtIncident extends ForegroundDebtContext {
  rawFrameDeltaMs: number;
  driverFrameDeltaMs: number;
  scaledDeltaMs: number;
  accumulatorBeforeMs: number;
  accumulatorBeforeConsumptionMs: number;
  stepsConsumed: number;
  accumulatorAfterMs: number;
  droppedDebtMs: number;
}

/** Session-only observation; context is read only on incidents, no IPC/timers/RNG. */
export class ForegroundDebtDiagnostics {
  private stats = this.initialStats();
  private incidents: ForegroundDebtIncident[] = [];
  constructor(private readonly enabled: boolean) {}
  private initialStats() { return {
    lastRawFrameDeltaMs: 0, lastDriverFrameDeltaMs: 0, lastScaledDeltaMs: 0,
    lastForegroundSteps: 0, foregroundStepCapHit: false, consecutiveStepCapFrames: 0,
    totalStepCapFrames: 0, peakForegroundAccumulatorMs: 0, droppedForegroundDebtMs: 0,
    largestSingleDroppedDebtMs: 0, lastDebtIncidentWorldMonth: undefined as number | undefined,
  }; }
  record(rawFrameDeltaMs: number, driverFrameDeltaMs: number, result: ForegroundStepResult, context: () => ForegroundDebtContext) {
    if (!this.enabled) return;
    const stats = this.stats;
    stats.lastRawFrameDeltaMs = rawFrameDeltaMs;
    stats.lastDriverFrameDeltaMs = driverFrameDeltaMs;
    stats.lastScaledDeltaMs = result.scaledDeltaMs;
    stats.lastForegroundSteps = result.steps;
    stats.foregroundStepCapHit = result.stepCapHit;
    stats.consecutiveStepCapFrames = result.stepCapHit ? stats.consecutiveStepCapFrames + 1 : 0;
    if (result.stepCapHit) stats.totalStepCapFrames++;
    stats.peakForegroundAccumulatorMs = Math.max(stats.peakForegroundAccumulatorMs, result.accumulatorBeforeConsumptionMs);
    stats.droppedForegroundDebtMs += result.droppedDebtMs;
    stats.largestSingleDroppedDebtMs = Math.max(stats.largestSingleDroppedDebtMs, result.droppedDebtMs);
    if (!result.stepCapHit && !result.droppedDebtMs) return;
    const observed = context();
    stats.lastDebtIncidentWorldMonth = observed.worldMonth;
    this.incidents.push({ ...observed, rawFrameDeltaMs, driverFrameDeltaMs, scaledDeltaMs: result.scaledDeltaMs,
      accumulatorBeforeMs: result.accumulatorBeforeMs, accumulatorBeforeConsumptionMs: result.accumulatorBeforeConsumptionMs,
      stepsConsumed: result.steps, accumulatorAfterMs: result.accumulatorMs, droppedDebtMs: result.droppedDebtMs });
    if (this.incidents.length > 20) this.incidents.shift();
  }
  snapshot(foregroundAccumulatorMs: number) {
    if (!this.enabled) return undefined;
    return { ...this.stats, foregroundAccumulatorMs,
      foregroundAccumulatorSteps: foregroundAccumulatorMs / SIMULATION_FIXED_STEP_MS,
      counterWindow: "session cumulative since hydration/reset", incidentCapacity: 20,
      incidents: this.incidents.map(incident => ({ ...incident })) };
  }
  reset() { this.stats = this.initialStats(); this.incidents = []; }
}
