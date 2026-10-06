import type { DesktopWakeMessage } from "../../desktop/DesktopWakeLifecycle";

export interface WakeLoop {
  resetDelta?: () => void; running?: boolean; started?: boolean; actualFps?: number;
  targetFps?: number; rawDelta?: number; delta?: number; _coolDown?: number; panicMax?: number;
  raf?: { isRunning?: boolean; isSetTimeOut?: boolean };
}
export function readPhaserLoop(loop: WakeLoop) {
  return { running: loop.running, started: loop.started, actualFps: loop.actualFps, targetFps: loop.targetFps,
    rawDelta: loop.rawDelta, delta: loop.delta, coolDown: loop._coolDown, panicMax: loop.panicMax,
    raf: { isRunning: loop.raf?.isRunning, isSetTimeOut: loop.raf?.isSetTimeOut } };
}
export function isDesktopWakeMessage(value: unknown): value is DesktopWakeMessage {
  const message = value as DesktopWakeMessage | undefined;
  return !!message && ["resume", "unlock-screen", "user-did-become-active", "focus"].includes(message.source)
    && Number.isFinite(message.timestamp) && Number.isSafeInteger(message.sequence) && message.sequence > 0;
}

interface Incident {
  source: DesktopWakeMessage["source"]; timestamp: number; receivedAt: number;
  before: ReturnType<typeof readPhaserLoop>; resetApplied: boolean;
  firstNormalFrameLatencyMs?: number;
  samples: Array<{ thresholdSeconds: number; elapsedMs: number; observedCallbackFps: number; loop: ReturnType<typeof readPhaserLoop> }>;
}
/** Resyncs only Phaser time bookkeeping. Never receives a world, RNG or driver. */
export class DesktopWakeRecovery {
  private lastSequence = 0;
  private incidents: Incident[] = [];
  private pending: Array<{ incident: Incident; start: number; frames: number; lastSampleFrames: number; lastSampleAt: number }> = [];
  constructor(private readonly debug: boolean, private readonly now = () => performance.now()) {}
  wake(message: unknown, loop: WakeLoop) {
    if (!isDesktopWakeMessage(message) || message.sequence <= this.lastSequence) return;
    this.lastSequence = message.sequence;
    const before = this.debug ? readPhaserLoop(loop) : undefined;
    const resetApplied = message.source !== "focus" && typeof loop.resetDelta === "function";
    if (resetApplied) loop.resetDelta!();
    if (!this.debug) return;
    const start = this.now();
    const incident: Incident = { source: message.source, timestamp: message.timestamp, receivedAt: Date.now(), before: before!, resetApplied, samples: [] };
    this.incidents.push(incident);
    if (this.incidents.length > 20) this.incidents.shift();
    this.pending = this.pending.filter(item => this.incidents.includes(item.incident));
    this.pending.push({ incident, start, frames: 0, lastSampleFrames: 0, lastSampleAt: start });
  }
  frame(loop: WakeLoop) {
    if (!this.debug || !this.pending.length) return;
    const now = this.now();
    for (const item of this.pending) {
      item.frames++;
      const elapsedMs = Math.max(0, now - item.start);
      // resetDelta can produce a zero initial delta; that is not a normal cadence observation.
      if (item.incident.firstNormalFrameLatencyMs === undefined && (loop.rawDelta ?? 0) > 0 && loop.rawDelta! <= 25) {
        item.incident.firstNormalFrameLatencyMs = elapsedMs;
      }
      const thresholdSeconds = [1, 5, 10][item.incident.samples.length];
      if (thresholdSeconds !== undefined && elapsedMs >= thresholdSeconds * 1000) {
        item.incident.samples.push({ thresholdSeconds, elapsedMs,
          observedCallbackFps: (item.frames - item.lastSampleFrames) * 1000 / Math.max(1, now - item.lastSampleAt),
          loop: readPhaserLoop(loop) });
        item.lastSampleFrames = item.frames; item.lastSampleAt = now;
      }
    }
    this.pending = this.pending.filter(item => item.incident.samples.length < 3);
  }
  snapshot(loop: WakeLoop) {
    if (!this.debug) return undefined;
    const latest = (source: DesktopWakeMessage["source"]) => [...this.incidents].reverse().find(item => item.source === source);
    return { loop: readPhaserLoop(loop), resumeToFirstNormalFrameLatencyMs: latest("resume")?.firstNormalFrameLatencyMs,
      focusToFirstNormalFrameLatencyMs: latest("focus")?.firstNormalFrameLatencyMs,
      normalFrameDefinition: "first observed Core callback with rawDelta > 0 and <=25ms; not proof of sustained recovery",
      sampleDefinition: "1/5/10s monotonic elapsed thresholds, interval Core callbacks/sec; delayed callbacks report actual elapsed, Phaser FPS separate",
      pendingObservations: this.pending.length, incidentCapacity: 20,
      incidents: this.incidents.map(item => ({ ...item, before: { ...item.before, raf: { ...item.before.raf } },
        samples: item.samples.map(sample => ({ ...sample, loop: { ...sample.loop, raf: { ...sample.loop.raf } } })) })) };
  }
}
