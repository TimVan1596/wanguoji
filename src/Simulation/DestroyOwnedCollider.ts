/** Phaser 3.55.2 removes active entries before adding pending entries. */
export function destroyOwnedCollider(collider: { destroy(): void; world?: any }) {
  const pending = collider.world?.colliders?._pending;
  if (Array.isArray(pending)) {
    const index = pending.indexOf(collider);
    if (index >= 0) pending.splice(index, 1);
  }
  if (collider.world !== null) collider.destroy();
}
