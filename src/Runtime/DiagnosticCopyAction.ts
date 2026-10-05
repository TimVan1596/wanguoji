import { diagnosticErrorMessage } from "./DiagnosticsReport";

/** Nothing is collected or serialized until the returned click action runs. */
export function createDiagnosticCopyAction(
  build: () => string,
  write: (text: string) => Promise<void>,
  feedback: (text: string) => void,
  label: string
) {
  return async () => {
    try {
      await write(build());
      feedback(`${label}已复制`);
    } catch (error) {
      console.error("Diagnostics copy failed", error);
      feedback(`复制失败：${diagnosticErrorMessage(error)}`);
    }
  };
}
