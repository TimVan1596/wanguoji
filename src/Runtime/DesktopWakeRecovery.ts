import type { DesktopWakeMessage } from "../../desktop/DesktopWakeLifecycle";

export interface WakeLoop {
  resetDelta?: () => void; running?: boolean; started?: boolean; actualFps?: number;
  targetFps?: number; rawDelta?: number; delta?: number; _coolDown?: number; panicMax?: number;
  raf?: { isRunning?: boolean; isSetTimeOut?: boolean };
}
export function readPhaserLoop(loop: WakeLoop) {
  return { frameScheduler: loop.raf?.isSetTimeOut === true ? "SET_TIMEOUT" : loop.raf?.isSetTimeOut === false ? "RAF" : undefined,
    running: loop.running, started: loop.started, actualFps: loop.actualFps, targetFps: loop.targetFps,
    rawDelta: loop.rawDelta, delta: loop.delta, coolDown: loop._coolDown, panicMax: loop.panicMax,
    raf: { isRunning: loop.raf?.isRunning, isSetTimeOut: loop.raf?.isSetTimeOut } };
}
export function isDesktopWakeMessage(value: unknown): value is DesktopWakeMessage {
  const message = value as DesktopWakeMessage | undefined;
  return !!message && ["resume", "unlock-screen", "user-did-become-active", "focus"].includes(message.source)
    && Number.isFinite(message.timestamp) && Number.isSafeInteger(message.sequence) && message.sequence > 0;
}

interface Incident {
  source: DesktopWakeMessage["source"]; timestamp: number; receivedAt: number; dispatchLatencyMs: number;
  before: ReturnType<typeof readPhaserLoop>; resetApplied: boolean;
  firstNormalFrameLatencyMs?: number; normalFrameObservationExpired?: boolean;
  samples: Array<{ thresholdSeconds: number; elapsedMs: number; observedCallbackFps: number; loop: ReturnType<typeof readPhaserLoop> }>;
}
/** Resyncs only Phaser time bookkeeping. Never receives a world, RNG or driver. */
export class DesktopWakeRecovery {
  private lastSequence = 0;
  private callbackTimes: number[] = [];
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
    const receivedAt = Date.now();
    const incident: Incident = { source: message.source, timestamp: message.timestamp, receivedAt,
      dispatchLatencyMs: Math.max(0, receivedAt - message.timestamp), before: before!, resetApplied, samples: [] };
    this.incidents.push(incident);
    if (this.incidents.length > 20) this.incidents.shift();
    this.pending = this.pending.filter(item => this.incidents.includes(item.incident));
    this.pending.push({ incident, start, frames: 0, lastSampleFrames: 0, lastSampleAt: start });
  }
  frame(loop: WakeLoop) {
    if (!this.debug) return;
    const now = this.now();
    this.callbackTimes.push(now);
    while (this.callbackTimes.length > 300 || (this.callbackTimes.length > 1 && this.callbackTimes[0] < now - 1000)) this.callbackTimes.shift();
    for (const item of this.pending) {
      item.frames++;
      const elapsedMs = Math.max(0, now - item.start);
      // resetDelta can produce a zero initial delta; that is not a normal cadence observation.
      if (item.incident.firstNormalFrameLatencyMs === undefined && (loop.rawDelta ?? 0) > 0 && loop.rawDelta! <= 25) {
        item.incident.firstNormalFrameLatencyMs = item.incident.dispatchLatencyMs + elapsedMs;
      }
      const thresholdSeconds = [1, 5, 10][item.incident.samples.length];
      if (thresholdSeconds !== undefined && elapsedMs >= thresholdSeconds * 1000) {
        item.incident.samples.push({ thresholdSeconds, elapsedMs,
          observedCallbackFps: (item.frames - item.lastSampleFrames) * 1000 / Math.max(1, now - item.lastSampleAt),
          loop: readPhaserLoop(loop) });
        item.lastSampleFrames = item.frames; item.lastSampleAt = now;
      }
    }
    this.pending = this.pending.filter(item => {
      if (now - item.start >= 60_000 && item.incident.firstNormalFrameLatencyMs === undefined) {
        item.incident.normalFrameObservationExpired = true;
      }
      return item.incident.samples.length < 3 ||
        (item.incident.firstNormalFrameLatencyMs === undefined && !item.incident.normalFrameObservationExpired);
    });
  }
  snapshot(loop: WakeLoop) {
    if (!this.debug) return undefined;
    const latest = (source: DesktopWakeMessage["source"]) => [...this.incidents].reverse().find(item => item.source === source);
    const callbackSpanMs = this.callbackTimes.length > 1 ? this.callbackTimes[this.callbackTimes.length - 1] - this.callbackTimes[0] : 0;
    return { observedCallbackFps: callbackSpanMs > 0 ? (this.callbackTimes.length - 1) * 1000 / callbackSpanMs : undefined,
      callbackObservation: { sampleCount: this.callbackTimes.length, spanMs: callbackSpanMs, capacity: 300,
        definition: "most recent 1s Core callback cadence (up to300 callbacks), active even while world paused; not renderer CPU measurement" },
      loop: readPhaserLoop(loop), resumeToFirstNormalFrameLatencyMs: latest("resume")?.firstNormalFrameLatencyMs,
      focusToFirstNormalFrameLatencyMs: latest("focus")?.firstNormalFrameLatencyMs,
      normalFrameDefinition: "OS/focus event to first observed Core callback with rawDelta > 0 and <=25ms, including IPC dispatch delay; wall-clock jump can affect dispatch estimate; not sustained recovery; observation expires after 60s of callback time",
      sampleDefinition: "1/5/10s monotonic elapsed thresholds since receipt (dispatch delay separate), interval Core callbacks/sec; delayed callbacks report actual elapsed, Phaser FPS separate",
      pendingObservations: this.pending.length, incidentCapacity: 20,
      incidents: this.incidents.map(item => ({ ...item, before: { ...item.before, raf: { ...item.before.raf } },
        samples: item.samples.map(sample => ({ ...sample, loop: { ...sample.loop, raf: { ...sample.loop.raf } } })) })) };
  }
}
