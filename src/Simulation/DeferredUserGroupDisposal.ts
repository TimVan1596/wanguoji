interface DisposableGroup {
  scene?: unknown;
  disposalPending: boolean;
  finishRuntimeDisposal(): void;
  once(event: string, callback: () => void): unknown;
}
interface SceneEvents {
  on(event: string, callback: () => void, context?: unknown): unknown;
  off(event: string, callback: () => void, context?: unknown): unknown;
}

/** Core-owned runtime resources, bounded by registered user groups, not deaths over session lifetime.
 * Every pending group is deduplicated and drained at the same scene's POST_UPDATE.
 * Fixed-step end is NOT a scene UpdateList boundary.
 */
export class DeferredUserGroupDisposal {
  private registered = new Set<DisposableGroup>();
  private pending = new Map<DisposableGroup, number>();
  private events?: SceneEvents;
  private frame = 0;
  private peakPending = 0;

  constructor(private readonly getSceneFrame?: () => number) {}

  bind(events: SceneEvents) {
    if (this.events === events) return;
    this.unbind();
    this.events = events;
    events.on("postupdate", this.onPostUpdate, this);
    events.on("shutdown", this.onShutdown, this);
  }

  register(group: DisposableGroup) {
    if (this.registered.has(group)) return;
    this.registered.add(group);
    group.once("destroy", () => { this.registered.delete(group); this.pending.delete(group); });
  }

  enqueue(group: DisposableGroup) {
    if (!group.scene || !group.disposalPending || this.pending.has(group)) return;
    this.register(group);
    this.pending.set(group, this.getSceneFrame?.() ?? this.frame);
    this.peakPending = Math.max(this.peakPending, this.pending.size);
  }

  /** Only POST_UPDATE or paused/reset teardown, never an in-progress UPDATE traversal. */
  flushAtSafeBoundary() {
    for (const group of this.pending.keys()) {
      this.pending.delete(group);
      this.registered.delete(group);
      if (group.scene && group.disposalPending) group.finishRuntimeDisposal();
    }
  }

  resetAtSafeBoundary() {
    this.flushAtSafeBoundary();
    this.registered.clear();
    this.pending.clear();
    this.frame = 0;
    this.peakPending = 0;
  }

  snapshot() {
    let oldestPendingSceneFrames = 0;
    const currentFrame = this.getSceneFrame?.() ?? this.frame;
    this.pending.forEach((frame) => { oldestPendingSceneFrames = Math.max(oldestPendingSceneFrames, currentFrame - frame); });
    return { deferredUserGroupDisposals: this.pending.size, registeredUserGroups: this.registered.size,
      disposalSceneFrames: this.frame, peakDeferredUserGroupDisposals: this.peakPending,
      oldestPendingSceneFrames, warning: oldestPendingSceneFrames >= 3 ? "USER_GROUP_DISPOSAL_STALLED" : undefined };
  }

  private onPostUpdate() { this.frame++; this.flushAtSafeBoundary(); }
  private onShutdown() { this.resetAtSafeBoundary(); this.unbind(); }
  private unbind() {
    this.events?.off("postupdate", this.onPostUpdate, this);
    this.events?.off("shutdown", this.onShutdown, this);
    this.events = undefined;
  }
}
