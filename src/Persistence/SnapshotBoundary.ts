export interface SnapshotBoundaryState {
  paused: boolean;
  clockElapsedMs: number;
  simulationAccumulatorMs: number;
}

const BOUNDARY_EPSILON_MS = 1e-6;

export function isSafeSnapshotBoundary(state: SnapshotBoundaryState) {
  return (
    state.paused &&
    Number.isFinite(state.clockElapsedMs) &&
    Number.isFinite(state.simulationAccumulatorMs) &&
    Math.abs(state.clockElapsedMs) <= BOUNDARY_EPSILON_MS &&
    Math.abs(state.simulationAccumulatorMs) <= BOUNDARY_EPSILON_MS
  );
}
