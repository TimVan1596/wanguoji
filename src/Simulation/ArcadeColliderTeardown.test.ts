import { describe, expect, it, vi } from "vitest";
import { teardownArcadeColliders } from "./ArcadeColliderTeardown";

interface QueueCollider {
  destroyed: ReturnType<typeof vi.fn>;
  destroy(): void;
}

function createDeferredProcessQueue() {
  const active: QueueCollider[] = [];
  const pending: QueueCollider[] = [];
  const destroyQueue: QueueCollider[] = [];
  const listeners: Array<() => void> = [];
  const queue = {
    add(item: QueueCollider) { pending.push(item); },
    remove(item: QueueCollider) { destroyQueue.push(item); },
    getActive() { return active; },
    update() {
      while (destroyQueue.length) {
        const item = destroyQueue.shift()!;
        const index = active.indexOf(item);
        if (index >= 0) active.splice(index, 1);
      }
      while (pending.length) active.push(pending.shift()!);
      return active;
    },
    listeners,
  };
  return queue;
}

describe("Arcade collider ProcessQueue teardown", () => {
  it("drains deferred destroys before snapshot, then destroys remaining active colliders and drains again", () => {
    const queue = createDeferredProcessQueue();
    const makeCollider = () => {
      let world: typeof queue | null = queue;
      const destroyed = vi.fn(() => {
        if (!world) throw new Error("removeCollider read world=null");
        world.remove(collider);
        world = null;
      });
      const collider: QueueCollider = { destroyed, destroy: destroyed };
      return { collider, getWorld: () => world };
    };
    const a = makeCollider();
    const b = makeCollider();
    const c = makeCollider();
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
    expect(a.collider.destroyed).toHaveBeenCalledTimes(1);
    expect(b.collider.destroyed).toHaveBeenCalledTimes(1);
    expect(c.collider.destroyed).toHaveBeenCalledTimes(1);
  });

  it("activates pending additions during pre-drain, destroys them, and does not invoke collision callbacks", () => {
    const queue = createDeferredProcessQueue();
    const makeCollider = () => {
      let world: typeof queue | null = queue;
      const destroyed = vi.fn(() => {
        if (!world) throw new Error("collider destroyed twice");
        world.remove(collider);
        world = null;
      });
      const collider: QueueCollider = { destroyed, destroy: destroyed };
      return collider;
    };
    const active = makeCollider();
    const pending = makeCollider();
    queue.add(active);
    queue.update();
    queue.add(pending);

    const diagnostics = teardownArcadeColliders(queue);
    expect(diagnostics.activeBeforeDrain).toBe(1);
    expect(diagnostics.activeAfterPreDrain).toBe(2);
    expect(diagnostics.destroyedByCore).toBe(2);
    expect(diagnostics.activeAfterPostDrain).toBe(0);
    expect(active.destroyed).toHaveBeenCalledTimes(1);
    expect(pending.destroyed).toHaveBeenCalledTimes(1);
    expect(queue.listeners).toHaveLength(0);
  });
});
