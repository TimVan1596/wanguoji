import { RollingStepPerformance, STEP_PERFORMANCE_SAMPLE_CAPACITY } from "./RollingStepPerformance";
import { runtimeProfilingEnabled } from "./MonthlyPhaseProfiler";

const PHASES = ["Core CPU", "fixed simulation CPU", "manual Arcade physics step", "logical simulation step",
  "AutoSimulator.advance", "determinism checkpoint", "LogicalUnitRegistry.syncVisuals", "faction labels",
  "faction focus", "player presentation updates", "block presentation updates", "validateWorldStateInDev",
  "history publish/notify", "history UI query derivation", "presentation CPU", "frame delta", "unattributed frame time"];

/** Nested timings overlap. Residual includes browser scheduling, rendering, React and unmeasured work;
 * it is an estimate from frame delta, not a renderer CPU measurement. */
export class FrameAttribution {
  private totals = new Map(PHASES.map((name) => [name, 0]));
  private samples = new RollingStepPerformance();
  constructor(private readonly enabled: boolean, private readonly now = () => performance.now()) {}
  measure<T>(name: string, work: () => T): T {
    if (!this.enabled) return work();
    const start = this.now();
    try { return work(); }
    finally { this.add(name, this.now() - start); }
  }
  add(name: string, duration: number) {
    if (this.enabled && this.totals.has(name)) this.totals.set(name, (this.totals.get(name) ?? 0) + Math.max(0, duration));
  }
  finishFrame(delta: number, coreCpu: number, fixedCpu: number) {
    if (!this.enabled) return;
    this.add("Core CPU", coreCpu);
    this.add("fixed simulation CPU", fixedCpu);
    this.add("frame delta", delta);
    // External React work runs between Core calls. Nested history time is already included in Core.
    this.add("unattributed frame time", Math.max(0, delta - coreCpu));
    this.totals.forEach((duration, name) => { this.samples.record(name, duration); this.totals.set(name, 0); });
  }
  snapshot() {
    return { enabled: this.enabled, timings: this.samples.snapshot(),
      statisticsWindow: `rolling ${STEP_PERFORMANCE_SAMPLE_CAPACITY} frames (or available samples)`,
      frameDeltaSource: "Phaser TimeStep.rawDelta (unsmoothed wall-clock); Scene delta fallback",
      interpretation: "Nested phases overlap; unattributed = max(0, frame delta - current Core CPU), includes frame pacing/render/React/GC; not measured renderer CPU." };
  }
  reset() { this.samples.reset(); this.totals.forEach((_, name) => this.totals.set(name, 0)); }
}
export const frameAttribution = new FrameAttribution(runtimeProfilingEnabled);
