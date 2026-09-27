export interface ColliderProcessQueue<T> {
  getActive(): T[];
  update(): T[];
}

export interface ArcadeColliderTeardownDiagnostics {
  activeBeforeDrain: number;
  activeAfterPreDrain: number;
  destroyedByCore: number;
  activeAfterPostDrain: number;
}

/** Drain deferred queue work around Core-owned destruction without stepping physics. */
export function teardownArcadeColliders<T extends { destroy(): void }>(
  queue: ColliderProcessQueue<T>
): ArcadeColliderTeardownDiagnostics {
  const activeBeforeDrain = queue.getActive().length;
  queue.update();
  const activeSnapshot = [...queue.getActive()];
  const activeAfterPreDrain = activeSnapshot.length;
  activeSnapshot.forEach((collider) => collider.destroy());
  queue.update();
  return {
    activeBeforeDrain,
    activeAfterPreDrain,
    destroyedByCore: activeSnapshot.length,
    activeAfterPostDrain: queue.getActive().length,
  };
}
