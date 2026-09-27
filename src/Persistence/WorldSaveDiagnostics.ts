export interface WorldSaveStorageDiagnostics {
  status: "unknown" | "present" | "absent" | "invalid" | "error";
  savedAt?: string;
  worldMonth?: number;
  schemaVersion?: number;
  lastAction?: string;
  serializedBytes?: number;
  writeDurationMs?: number;
  error?: string;
}

let current: WorldSaveStorageDiagnostics = { status: "unknown" };
const listeners = new Set<(value: WorldSaveStorageDiagnostics) => void>();

export function getWorldSaveStorageDiagnostics() {
  return current;
}

export function setWorldSaveStorageDiagnostics(value: WorldSaveStorageDiagnostics) {
  current = value;
  listeners.forEach((listener) => listener(current));
}

export function subscribeWorldSaveStorageDiagnostics(
  listener: (value: WorldSaveStorageDiagnostics) => void
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
