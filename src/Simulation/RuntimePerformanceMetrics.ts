export const RUNTIME_PERFORMANCE_SAMPLE_CAPACITY = 600;

export interface RuntimePerformanceSnapshot {
  renderFrameCount: number;
  frameDeltaMs: { current?: number; average?: number; p95?: number; max?: number };
  longFrames: { over25ms: number; over33ms: number; over50ms: number; over100ms: number };
  simulationStepsPerFrame: { average?: number; max?: number };
  fixedStepCpuMs: { average?: number; p95?: number };
  presentationCpuMs: { average?: number; p95?: number };
  sampleCount: number;
}

export function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1));
  return sorted[index];
}

export class RuntimePerformanceMetrics {
  private frameDeltas: number[] = [];
  private stepsPerFrame: number[] = [];
  private fixedStepCpu: number[] = [];
  private presentationCpu: number[] = [];
  private cursor = 0;
  private count = 0;
  private frameCount = 0;
  private currentFrameDelta: number | undefined;
  private longFrames = { over25ms: 0, over33ms: 0, over50ms: 0, over100ms: 0 };

  constructor(private readonly capacity = RUNTIME_PERFORMANCE_SAMPLE_CAPACITY) {}

  reset() {
    this.frameDeltas = [];
    this.stepsPerFrame = [];
    this.fixedStepCpu = [];
    this.presentationCpu = [];
    this.cursor = 0;
    this.count = 0;
    this.frameCount = 0;
    this.currentFrameDelta = undefined;
    this.longFrames = { over25ms: 0, over33ms: 0, over50ms: 0, over100ms: 0 };
  }

  record(frameDeltaMs: number, steps: number, fixedStepCpuMs: number, presentationCpuMs: number) {
    const delta = Math.max(0, Number.isFinite(frameDeltaMs) ? frameDeltaMs : 0);
    this.currentFrameDelta = delta;
    this.write(this.frameDeltas, delta);
    this.write(this.stepsPerFrame, Math.max(0, steps));
    this.write(this.fixedStepCpu, Math.max(0, fixedStepCpuMs));
    this.write(this.presentationCpu, Math.max(0, presentationCpuMs));
    this.frameCount += 1;
    if (delta > 25) this.longFrames.over25ms += 1;
    if (delta > 33) this.longFrames.over33ms += 1;
    if (delta > 50) this.longFrames.over50ms += 1;
    if (delta > 100) this.longFrames.over100ms += 1;
  }

  snapshot(): RuntimePerformanceSnapshot {
    const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
    const max = (values: number[]) => values.length ? values.reduce((current, value) => Math.max(current, value), -Infinity) : undefined;
    const frames = this.ordered(this.frameDeltas);
    const steps = this.ordered(this.stepsPerFrame);
    const fixedCpu = this.ordered(this.fixedStepCpu);
    const presentationCpu = this.ordered(this.presentationCpu);
    return {
      renderFrameCount: this.frameCount,
      frameDeltaMs: { current: this.currentFrameDelta, average: average(frames), p95: percentile(frames, 0.95), max: max(frames) },
      longFrames: { ...this.longFrames },
      simulationStepsPerFrame: { average: average(steps), max: max(steps) },
      fixedStepCpuMs: { average: average(fixedCpu), p95: percentile(fixedCpu, 0.95) },
      presentationCpuMs: { average: average(presentationCpu), p95: percentile(presentationCpu, 0.95) },
      sampleCount: this.count,
    };
  }

  private write(buffer: number[], value: number) {
    if (this.capacity <= 0) return;
    if (buffer.length < this.capacity) buffer.push(value);
    else buffer[this.cursor] = value;
    // All four buffers advance on each record; cursor/count are advanced once below.
    if (buffer === this.presentationCpu) {
      this.cursor = (this.cursor + 1) % this.capacity;
      this.count = Math.min(this.capacity, this.count + 1);
    }
  }

  private ordered(buffer: number[]) {
    if (buffer.length < this.capacity || this.cursor === 0) return [...buffer];
    return [...buffer.slice(this.cursor), ...buffer.slice(0, this.cursor)];
  }
}
