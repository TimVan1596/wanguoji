import {
  BASE_PLAY_RATE,
  MAX_BACKGROUND_REAL_MS,
  MAX_CATCH_UP_STEPS,
  SIMULATION_FIXED_STEP_MS,
  calculateBackgroundSimulationDebtMs,
} from "./SimulationDriver";
import type { GridGodRuntimeMode } from "../Runtime/DesktopRuntime";

export type BackgroundProgressionMode = "FOREGROUND" | "CATCH_UP";

export const CATCH_UP_CPU_BUDGET_MS = 10;
export const MAX_CATCH_UP_STEPS_PER_FRAME = 90;

export interface BackgroundHiddenState {
  hiddenAtRealMs: number;
  hiddenSelectedSpeed: number;
  hiddenPaused: boolean;
  hiddenWorldInstanceId: number;
}

export interface BackgroundProgressionSnapshot {
  mode: BackgroundProgressionMode;
  hidden?: BackgroundHiddenState;
  catchUpDebtSteps: number;
  catchUpTotalSteps: number;
  catchUpCompletedSteps: number;
  catchUpProgress: number;
  catchUpTruncated: boolean;
  catchUpShowOverlay: boolean;
  catchUpHiddenElapsedRealMs: number;
  suppressNextForegroundDelta: boolean;
}

export interface BackgroundCatchUpChunkResult {
  executedSteps: number;
  remainingSteps: number;
  complete: boolean;
  cpuMs: number;
}

export default class BackgroundProgressionController {
  private mode: BackgroundProgressionMode = "FOREGROUND";
  private hidden: BackgroundHiddenState | undefined;
  private catchUpDebtSteps = 0;
  private catchUpTotalSteps = 0;
  private catchUpCompletedSteps = 0;
  private catchUpTruncated = false;
  private catchUpShowOverlay = false;
  private catchUpHiddenElapsedRealMs = 0;
  private suppressNextForegroundDelta = false;

  handleHidden({
    nowMs,
    selectedSpeed,
    paused,
    worldInstanceId,
    runtimeMode = "WEB_CATCH_UP",
  }: {
    nowMs: number;
    selectedSpeed: number;
    paused: boolean;
    worldInstanceId: number;
    runtimeMode?: GridGodRuntimeMode;
  }) {
    if (runtimeMode === "DESKTOP_CONTINUOUS") {
      this.hidden = undefined;
      return;
    }
    this.hidden = {
      hiddenAtRealMs: nowMs,
      hiddenSelectedSpeed: selectedSpeed,
      hiddenPaused: paused,
      hiddenWorldInstanceId: worldInstanceId,
    };
  }

  handleVisible({
    nowMs,
    worldInstanceId,
    basePlayRate = BASE_PLAY_RATE,
    maxRealMs = MAX_BACKGROUND_REAL_MS,
    maxCatchUpSteps = MAX_CATCH_UP_STEPS,
    runtimeMode = "WEB_CATCH_UP",
  }: {
    nowMs: number;
    worldInstanceId: number;
    basePlayRate?: number;
    maxRealMs?: number;
    maxCatchUpSteps?: number;
    runtimeMode?: GridGodRuntimeMode;
  }) {
    this.suppressNextForegroundDelta = true;
    if (runtimeMode === "DESKTOP_CONTINUOUS") {
      this.hidden = undefined;
      return this.getSnapshot();
    }
    if (!this.hidden) {
      return this.getSnapshot();
    }

    const hidden = this.hidden;
    this.hidden = undefined;

    if (hidden.hiddenWorldInstanceId !== worldInstanceId) {
      this.resetCatchUp();
      return this.getSnapshot();
    }

    const debt = calculateBackgroundSimulationDebtMs({
      hiddenAtRealMs: hidden.hiddenAtRealMs,
      visibleAtRealMs: nowMs,
      speed: hidden.hiddenSelectedSpeed,
      basePlayRate,
      wasPaused: hidden.hiddenPaused,
      maxRealMs,
      maxCatchUpSteps,
    });
    const newDebtSteps = Math.floor(
      debt.simulationDebtMs / SIMULATION_FIXED_STEP_MS
    );

    this.catchUpHiddenElapsedRealMs += debt.realElapsedMs;
    this.catchUpTruncated =
      this.catchUpTruncated || debt.cappedByRealTime || debt.cappedBySteps;
    this.catchUpDebtSteps += newDebtSteps;
    this.catchUpTotalSteps += newDebtSteps;
    this.catchUpShowOverlay =
      this.catchUpShowOverlay || (debt.shouldShowOverlay && this.catchUpDebtSteps > 0);

    if (this.catchUpDebtSteps > 0) {
      this.mode = "CATCH_UP";
    } else {
      this.mode = "FOREGROUND";
    }

    return this.getSnapshot();
  }

  consumeSuppressNextForegroundDelta() {
    const value = this.suppressNextForegroundDelta;
    this.suppressNextForegroundDelta = false;
    return value;
  }

  isCatchingUp() {
    return this.mode === "CATCH_UP" && this.catchUpDebtSteps > 0;
  }

  runChunk({
    step,
    nowMs,
    cpuBudgetMs = CATCH_UP_CPU_BUDGET_MS,
    maxSteps = MAX_CATCH_UP_STEPS_PER_FRAME,
  }: {
    step: () => void;
    nowMs: () => number;
    cpuBudgetMs?: number;
    maxSteps?: number;
  }): BackgroundCatchUpChunkResult {
    if (!this.isCatchingUp() || maxSteps <= 0 || cpuBudgetMs <= 0) {
      return {
        executedSteps: 0,
        remainingSteps: this.catchUpDebtSteps,
        complete: !this.isCatchingUp(),
        cpuMs: 0,
      };
    }

    const startedAt = nowMs();
    let executedSteps = 0;
    while (this.catchUpDebtSteps > 0 && executedSteps < maxSteps) {
      if (executedSteps > 0 && nowMs() - startedAt >= cpuBudgetMs) {
        break;
      }
      step();
      this.catchUpDebtSteps -= 1;
      this.catchUpCompletedSteps += 1;
      executedSteps += 1;
    }

    if (this.catchUpDebtSteps <= 0) {
      this.mode = "FOREGROUND";
    }

    return {
      executedSteps,
      remainingSteps: this.catchUpDebtSteps,
      complete: this.catchUpDebtSteps <= 0,
      cpuMs: Math.max(0, nowMs() - startedAt),
    };
  }

  reset() {
    this.hidden = undefined;
    this.suppressNextForegroundDelta = false;
    this.resetCatchUp();
  }

  getSnapshot(): BackgroundProgressionSnapshot {
    return {
      mode: this.mode,
      hidden: this.hidden ? { ...this.hidden } : undefined,
      catchUpDebtSteps: this.catchUpDebtSteps,
      catchUpTotalSteps: this.catchUpTotalSteps,
      catchUpCompletedSteps: this.catchUpCompletedSteps,
      catchUpProgress:
        this.catchUpTotalSteps > 0
          ? Math.min(1, this.catchUpCompletedSteps / this.catchUpTotalSteps)
          : 1,
      catchUpTruncated: this.catchUpTruncated,
      catchUpShowOverlay: this.catchUpShowOverlay,
      catchUpHiddenElapsedRealMs: this.catchUpHiddenElapsedRealMs,
      suppressNextForegroundDelta: this.suppressNextForegroundDelta,
    };
  }

  private resetCatchUp() {
    this.mode = "FOREGROUND";
    this.catchUpDebtSteps = 0;
    this.catchUpTotalSteps = 0;
    this.catchUpCompletedSteps = 0;
    this.catchUpTruncated = false;
    this.catchUpShowOverlay = false;
    this.catchUpHiddenElapsedRealMs = 0;
  }
}
