export const STEP_PERFORMANCE_SAMPLE_CAPACITY = 300;

export interface StepTimingSummary {
  sampleCount: number;
  averageMs: number;
  p95Ms: number;
  maxMs: number;
}

export type StepTimingSnapshot = Record<string, StepTimingSummary>;

interface TimingRing {
  values: number[];
  nextIndex: number;
  count: number;
}

/** Session-only diagnostic ring buffers. It never reads or mutates simulation state. */
export class RollingStepPerformance {
  private samples = new Map<string, TimingRing>();

  record(name: string, durationMs: number) {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    const ring = this.samples.get(name) ?? { values: [], nextIndex: 0, count: 0 };
    ring.values[ring.nextIndex] = durationMs;
    ring.nextIndex = (ring.nextIndex + 1) % STEP_PERFORMANCE_SAMPLE_CAPACITY;
    ring.count = Math.min(STEP_PERFORMANCE_SAMPLE_CAPACITY, ring.count + 1);
    this.samples.set(name, ring);
  }

  snapshot(): StepTimingSnapshot {
    return Object.fromEntries([...this.samples.entries()].map(([name, ring]) => {
      const values = ring.values.slice(0, ring.count);
      const sorted = [...values].sort((a, b) => a - b);
      const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
      return [name, {
        sampleCount: ring.count,
        averageMs: values.reduce((sum, value) => sum + value, 0) / values.length,
        p95Ms: sorted[p95Index] ?? 0,
        maxMs: sorted.at(-1) ?? 0,
      }];
    }));
  }

  reset() {
    this.samples.clear();
  }
}
