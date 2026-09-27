import { createRequire } from "node:module";
import { describe, expect, it, vi } from "vitest";
import { teardownArcadeColliders } from "./ArcadeColliderTeardown";

const require = createRequire(import.meta.url);
const PhaserProcessQueue = require("phaser/src/structs/ProcessQueue") as new () => {
  add(item: Collider): unknown;
  remove(item: Collider): unknown;
  getActive(): Collider[];
  update(): Collider[];
};

interface Collider {
  destroy(): void;
  update(): void;
}

function createCollider(queue: InstanceType<typeof PhaserProcessQueue>) {
  let world: InstanceType<typeof PhaserProcessQueue> | null = queue;
  const destroy = vi.fn(() => {
    if (!world) throw new Error("removeCollider read world=null");
    world.remove(collider);
    world = null;
  });
  const update = vi.fn();
  const collider = { destroy, update };
  return { collider, getWorld: () => world };
}

describe("Arcade collider ProcessQueue teardown", () => {
  it("drains deferred destroys before snapshot, then destroys remaining active colliders and drains again", () => {
    const queue = new PhaserProcessQueue();
    const a = createCollider(queue);
    const b = createCollider(queue);
    const c = createCollider(queue);
    queue.add(a.collider);
    queue.add(b.collider);
    queue.add(c.collider);
    queue.update();

    // Gameplay already destroyed B: Phaser nulls its world but defers active removal.
    b.collider.destroy();
    expect(b.getWorld()).toBeNull();
    expect(queue.getActive()).toHaveLength(3);

    const diagnostics = teardownArcadeColliders(queue);
    expect(diagnostics).toEqual({
      activeBeforeDrain: 3,
      activeAfterPreDrain: 2,
      destroyedByCore: 2,
      activeAfterPostDrain: 0,
    });
    expect(a.collider.destroy).toHaveBeenCalledTimes(1);
    expect(b.collider.destroy).toHaveBeenCalledTimes(1);
    expect(c.collider.destroy).toHaveBeenCalledTimes(1);
    expect(a.collider.update).not.toHaveBeenCalled();
    expect(b.collider.update).not.toHaveBeenCalled();
    expect(c.collider.update).not.toHaveBeenCalled();
  });

  it("activates pending additions during pre-drain, destroys them, and does not invoke collision callbacks", () => {
    const queue = new PhaserProcessQueue();
    const activeRef = createCollider(queue);
    const pendingRef = createCollider(queue);
    const active = activeRef.collider;
    const pending = pendingRef.collider;
    queue.add(active);
    queue.update();
    queue.add(pending);

    const diagnostics = teardownArcadeColliders(queue);
    expect(diagnostics.activeBeforeDrain).toBe(1);
    expect(diagnostics.activeAfterPreDrain).toBe(2);
    expect(diagnostics.destroyedByCore).toBe(2);
    expect(diagnostics.activeAfterPostDrain).toBe(0);
    expect(active.destroy).toHaveBeenCalledTimes(1);
    expect(pending.destroy).toHaveBeenCalledTimes(1);
    expect(active.update).not.toHaveBeenCalled();
    expect(pending.update).not.toHaveBeenCalled();
  });
});
