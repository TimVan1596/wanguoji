export interface SnapshotBoundaryState {
  paused: boolean;
  clockElapsedMs: number;
  simulationAccumulatorMs: number;
}

const BOUNDARY_EPSILON_MS = 1e-6;

export interface SnapshotRequestState extends SnapshotBoundaryState {
  worldStarted: boolean;
  catchingUp: boolean;
  worldMonth: number;
}

export interface SnapshotRequestDiagnostics {
  status: "idle" | "waiting" | "boundary-reached" | "cancelled";
  requestMonth?: number;
  boundaryReachedMonth?: number;
  preExportElapsedMs?: number;
  preExportAccumulatorMs?: number;
  error?: string;
}

/** Coordinates a one-shot stop at the next fully committed world-month boundary. */
export class SnapshotBoundaryRequest {
  private pending?: {
    requestedMonth: number;
    resolve: () => void;
    reject: (error: Error) => void;
  };
  private diagnostics: SnapshotRequestDiagnostics = { status: "idle" };

  request(state: SnapshotRequestState) {
    if (!state.worldStarted) {
      return { promise: Promise.reject(new Error("Cannot request a snapshot before the world has started.")), pending: false };
    }
    if (state.catchingUp) {
      return { promise: Promise.reject(new Error("Wait for background catch-up to finish before requesting a snapshot.")), pending: false };
    }
    if (isSafeSnapshotBoundary(state)) {
      this.diagnostics = {
        status: "boundary-reached",
        requestMonth: state.worldMonth,
        boundaryReachedMonth: state.worldMonth,
        preExportElapsedMs: state.clockElapsedMs,
        preExportAccumulatorMs: state.simulationAccumulatorMs,
      };
      return { promise: Promise.resolve(), pending: false };
    }
    if (this.pending) {
      return { promise: Promise.reject(new Error("A safe snapshot request is already pending.")), pending: false };
    }
    const promise = new Promise<void>((resolve, reject) => {
      this.pending = { requestedMonth: state.worldMonth, resolve, reject };
    });
    this.diagnostics = { status: "waiting", requestMonth: state.worldMonth };
    return { promise, pending: true };
  }

  /** Called after each complete fixed step. Returns true only at the requested next month boundary. */
  reachBoundary(worldMonth: number, clockElapsedMs: number) {
    if (!this.pending || worldMonth <= this.pending.requestedMonth || Math.abs(clockElapsedMs) > BOUNDARY_EPSILON_MS) {
      return false;
    }
    this.diagnostics = {
      status: "boundary-reached",
      requestMonth: this.pending.requestedMonth,
      boundaryReachedMonth: worldMonth,
    };
    const pending = this.pending;
    this.pending = undefined;
    pending.resolve();
    return true;
  }

  recordPreExportState(clockElapsedMs: number, accumulatorMs: number) {
    if (this.diagnostics.status !== "boundary-reached") return;
    this.diagnostics = {
      ...this.diagnostics,
      preExportElapsedMs: clockElapsedMs,
      preExportAccumulatorMs: accumulatorMs,
    };
  }

  cancel(error: Error) {
    const pending = this.pending;
    if (!pending) return false;
    this.pending = undefined;
    this.diagnostics = {
      status: "cancelled",
      requestMonth: pending.requestedMonth,
      error: error.message,
    };
    pending.reject(error);
    return true;
  }

  getDiagnostics() {
    return { ...this.diagnostics };
  }
}

export function isSafeSnapshotBoundary(state: SnapshotBoundaryState) {
  return (
    state.paused &&
    Number.isFinite(state.clockElapsedMs) &&
    Number.isFinite(state.simulationAccumulatorMs) &&
    Math.abs(state.clockElapsedMs) <= BOUNDARY_EPSILON_MS &&
    Math.abs(state.simulationAccumulatorMs) <= BOUNDARY_EPSILON_MS
  );
}
