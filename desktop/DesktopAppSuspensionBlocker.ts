interface BlockerApi {
  start: (type: "prevent-app-suspension") => number;
  stop: (id: number) => boolean;
  isStarted: (id: number) => boolean;
}

/** Explicit debug A/B resource; a singleton owner for the lifetime of the main process. */
export class DesktopAppSuspensionBlocker {
  private id?: number;
  private closed = false;
  private error?: string;
  constructor(private readonly api: BlockerApi, private readonly enabled: boolean) {}
  start() {
    if (!this.enabled || this.closed || this.id !== undefined) return;
    try { this.id = this.api.start("prevent-app-suspension"); }
    catch (error) { this.error = error instanceof Error ? error.message : String(error); }
  }
  stop() {
    if (this.closed) return;
    this.closed = true;
    if (this.id !== undefined) this.api.stop(this.id);
  }
  snapshot() {
    const isStarted = this.id !== undefined && this.api.isStarted(this.id);
    return { status: isStarted ? "ON / prevent-app-suspension" : "OFF", id: this.id, isStarted,
      requested: this.enabled,
      startReason: this.enabled ? "explicit desktop debug launch + --wanguoji-prevent-app-suspension A/B" : "disabled (not debug or no explicit flag)",
      error: this.error };
  }
}
