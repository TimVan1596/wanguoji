export type GenealogyViewerCloseSource =
  | "EXPLICIT"
  | "ESCAPE"
  | "BACKDROP"
  | "FACTION_CHANGED"
  | "HOST_UNMOUNT";

export interface GenealogyViewerDiagnostics {
  open: boolean;
  lastCloseSource?: GenealogyViewerCloseSource;
  lastMuiReason?: string;
}

let diagnostics: GenealogyViewerDiagnostics = { open: false };
const listeners = new Set<(value: GenealogyViewerDiagnostics) => void>();

function publish(next: GenealogyViewerDiagnostics) {
  diagnostics = next;
  listeners.forEach((listener) => listener({ ...diagnostics }));
}

export function getGenealogyViewerDiagnostics() {
  return { ...diagnostics };
}

export function subscribeGenealogyViewerDiagnostics(listener: (value: GenealogyViewerDiagnostics) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recordGenealogyViewerOpen() {
  publish({ ...diagnostics, open: true, lastMuiReason: undefined });
}

export function recordGenealogyViewerClose(
  source: GenealogyViewerCloseSource,
  muiReason?: string
) {
  publish({ open: false, lastCloseSource: source, lastMuiReason: muiReason });
}
