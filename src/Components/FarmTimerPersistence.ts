export interface FarmTimerSaveState {
  name: string;
  elapsedMs: number;
  remainingMs: number;
  repeatCount: number;
  paused: boolean;
}

export function exportFarmTimerState(name: string, timer: {
  getElapsed(): number;
  getRemaining(): number;
  getRepeatCount(): number;
  paused: boolean;
}): FarmTimerSaveState {
  return {
    name,
    elapsedMs: timer.getElapsed(),
    remainingMs: timer.getRemaining(),
    repeatCount: timer.getRepeatCount(),
    paused: timer.paused,
  };
}

/** Phaser TimerEvent.startAt initializes elapsed; remaining is derived from delay - elapsed. */
export function getFarmTimerRestoreOptions(saved: FarmTimerSaveState | undefined, fallbackStartAt: number) {
  return {
    startAt: saved?.elapsedMs ?? fallbackStartAt,
    repeatCount: saved?.repeatCount,
    paused: saved?.paused,
  };
}
