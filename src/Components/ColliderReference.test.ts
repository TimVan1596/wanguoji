import { describe, expect, it, vi } from "vitest";
import ColliderReference from "./ColliderReference";

function fakeCollider() {
  let destroyed = false;
  return {
    destroy: vi.fn(() => {
      if (destroyed) throw new Error("collider destroyed twice");
      destroyed = true;
    }),
  };
}

describe("retained Arcade collider ownership", () => {
  it("does not destroy again when Core owns world teardown", () => {
    const reference = new ColliderReference<ReturnType<typeof fakeCollider>>();
    const collider = fakeCollider();
    reference.getOrCreate(() => collider);

    collider.destroy();
    reference.detachAfterWorldTeardown();
    reference.destroyOwned();

    expect(collider.destroy).toHaveBeenCalledTimes(1);
    expect(reference.current).toBeUndefined();
  });

  it("normal reset destroys the owned collider once and can attach a replacement", () => {
    const reference = new ColliderReference<ReturnType<typeof fakeCollider>>();
    const original = fakeCollider();
    const replacement = fakeCollider();
    const originalFactory = vi.fn(() => original);
    const replacementFactory = vi.fn(() => replacement);
    const duplicateFactory = vi.fn(fakeCollider);
    reference.getOrCreate(originalFactory);
    reference.destroyOwned();
    reference.getOrCreate(replacementFactory);
    reference.getOrCreate(duplicateFactory);
    reference.destroyOwned();

    expect(originalFactory).toHaveBeenCalledTimes(1);
    expect(replacementFactory).toHaveBeenCalledTimes(1);
    expect(duplicateFactory).not.toHaveBeenCalled();
    expect(original.destroy).toHaveBeenCalledTimes(1);
    expect(replacement.destroy).toHaveBeenCalledTimes(1);
    expect(reference.current).toBeUndefined();
  });

  it("supports consecutive hydration teardowns with a fresh collider each time", () => {
    const reference = new ColliderReference<ReturnType<typeof fakeCollider>>();
    const first = fakeCollider();
    const second = fakeCollider();
    reference.getOrCreate(() => first);
    first.destroy();
    reference.detachAfterWorldTeardown();
    reference.destroyOwned();

    reference.getOrCreate(() => second);
    second.destroy();
    reference.detachAfterWorldTeardown();
    reference.destroyOwned();

    expect(first.destroy).toHaveBeenCalledTimes(1);
    expect(second.destroy).toHaveBeenCalledTimes(1);
    expect(reference.current).toBeUndefined();
  });
});
