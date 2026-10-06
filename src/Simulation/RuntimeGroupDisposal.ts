/** Only at POST_UPDATE or quiescent reset/hydration, outside UpdateList traversal. */
export function destroyRuntimeGroupAtSafeBoundary(group: Phaser.GameObjects.Group, destroyChildren = false) {
  if (!group.scene) return;
  group.active = false;
  group.runChildUpdate = false;
  // Phaser 3.55.2 ProcessQueue removes active entries BEFORE inserting pending ones.
  const pending = (group.scene.sys.updateList as unknown as { _pending: unknown[] })._pending;
  const index = pending.indexOf(group);
  if (index >= 0) pending.splice(index, 1);
  group.destroy(destroyChildren, false);
}
