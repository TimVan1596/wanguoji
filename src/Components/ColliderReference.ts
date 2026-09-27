/** Tracks the convenience reference to a collider whose world may own teardown. */
export default class ColliderReference<T extends { destroy(): void }> {
  private collider?: T;

  get current() {
    return this.collider;
  }

  getOrCreate(create: () => T) {
    if (!this.collider) this.collider = create();
    return this.collider;
  }

  /** The physics world already destroyed it; release this reference without destroying again. */
  detachAfterWorldTeardown() {
    this.collider = undefined;
  }

  /** Used only when this owner initiates normal runtime replacement. */
  destroyOwned() {
    const collider = this.collider;
    this.collider = undefined;
    collider?.destroy();
  }
}
