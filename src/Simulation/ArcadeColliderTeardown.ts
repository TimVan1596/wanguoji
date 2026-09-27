export interface ColliderProcessQueue<T> {
  getActive(): T[];
  remove(item: T): unknown;
  update(): T[];
}

export interface TeardownCollider {
  destroy(): void;
  world?: unknown | null;
}

export interface ArcadeColliderTeardownDiagnostics {
  activeBeforeDrain: number;
  activeAfterPreDrain: number;
  destroyedByCore: number;
  staleAlreadyDestroyed: number;
  activeAfterPostDrain: number;
}

/** Drain deferred queue work around Core-owned destruction without stepping physics. */
export function teardownArcadeColliders<T extends TeardownCollider>(
  queue: ColliderProcessQueue<T>
): ArcadeColliderTeardownDiagnostics {
  const activeBeforeDrain = queue.getActive().length;
  queue.update();
  const activeSnapshot = [...queue.getActive()];
  const activeAfterPreDrain = activeSnapshot.length;
  let destroyedByCore = 0;
  let staleAlreadyDestroyed = 0;
  activeSnapshot.forEach((collider) => {
    if (collider.world === null) {
      queue.remove(collider);
      staleAlreadyDestroyed += 1;
      return;
    }
    collider.destroy();
    destroyedByCore += 1;
  });
  queue.update();
  return {
    activeBeforeDrain,
    activeAfterPreDrain,
    destroyedByCore,
    staleAlreadyDestroyed,
    activeAfterPostDrain: queue.getActive().length,
  };
}
