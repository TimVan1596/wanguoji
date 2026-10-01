export type AutosaveStatus = "SAVED" | "SKIPPED" | "FAILED";
export type CloseSaveStatus = "SAVED" | "FAILED" | "SKIPPED";

export function decideSingleInstance(lockAcquired: boolean) {
  return lockAcquired ? "CONTINUE" : "QUIT";
}

export class DesktopAutosaveGate {
  private activeRequestId?: string;

  begin(requestId: string) {
    if (this.activeRequestId) return false;
    this.activeRequestId = requestId;
    return true;
  }

  complete(requestId: string) {
    if (this.activeRequestId !== requestId) return false;
    this.activeRequestId = undefined;
    return true;
  }

  get pending() {
    return this.activeRequestId !== undefined;
  }
}

export type CloseDecision = "ALLOW" | "WAIT" | "CANCEL";

export class DesktopCloseHandshake {
  private awaitingSave = false;

  begin(worldStarted: boolean): CloseDecision {
    if (!worldStarted) return "ALLOW";
    if (this.awaitingSave) return "WAIT";
    this.awaitingSave = true;
    return "WAIT";
  }

  resolve(status: CloseSaveStatus) {
    if (!this.awaitingSave) return "CANCEL" as const;
    this.awaitingSave = false;
    return status === "SAVED" ? "ALLOW" as const : "CANCEL" as const;
  }

  timeout() {
    if (!this.awaitingSave) return "CANCEL" as const;
    this.awaitingSave = false;
    return "CANCEL" as const;
  }

  get pending() {
    return this.awaitingSave;
  }
}
