export const RENDERER_WARNING_SUMMARY_INTERVAL_MS = 30_000;
export const RENDERER_WARNING_MAX_IDENTITIES = 500;

interface WarningState {
  lastSummaryAt: number;
  suppressedCount: number;
}

export type WarningThrottleDecision =
  | { kind: "LOG" }
  | { kind: "SUPPRESS" }
  | { kind: "SUMMARY"; suppressedCount: number };

/** Dedupe identical warnings by their source identity; errors never use this helper. */
export class RendererWarningThrottle {
  private states = new Map<string, WarningState>();

  accept(key: string, nowMs: number): WarningThrottleDecision {
    const state = this.states.get(key);
    if (!state) {
      if (this.states.size >= RENDERER_WARNING_MAX_IDENTITIES) {
        const oldestKey = this.states.keys().next().value as string | undefined;
        if (oldestKey !== undefined) this.states.delete(oldestKey);
      }
      this.states.set(key, { lastSummaryAt: nowMs, suppressedCount: 0 });
      return { kind: "LOG" };
    }
    state.suppressedCount += 1;
    if (nowMs - state.lastSummaryAt < RENDERER_WARNING_SUMMARY_INTERVAL_MS) {
      return { kind: "SUPPRESS" };
    }
    const suppressedCount = state.suppressedCount;
    state.suppressedCount = 0;
    state.lastSummaryAt = nowMs;
    return { kind: "SUMMARY", suppressedCount };
  }
}
