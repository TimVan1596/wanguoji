export type PhaserInputPluginPrototype = {
  sortGameObjects: (gameObjects: any[], pointer: any) => any[];
};

const patchedPrototypes = new WeakSet<object>();

export type Phaser355CompatibilityResult = "INSTALLED" | "ALREADY_INSTALLED" | "UNSUPPORTED_VERSION";

/** Backports Phaser 3.60's null-camera and missing-render-list guards to the pinned 3.55.2 input plugin. */
export function installPhaser355InputCompatibility(
  version: string,
  prototype: PhaserInputPluginPrototype
): Phaser355CompatibilityResult {
  if (version !== "3.55.2") return "UNSUPPORTED_VERSION";
  if (patchedPrototypes.has(prototype)) return "ALREADY_INSTALLED";

  prototype.sortGameObjects = function (gameObjects, pointer) {
    if (gameObjects.length < 2 || !pointer?.camera) return gameObjects;

    const renderList = pointer.camera.renderList;
    return gameObjects.sort((a, b) =>
      Math.max(0, renderList.indexOf(b)) - Math.max(0, renderList.indexOf(a))
    );
  };
  patchedPrototypes.add(prototype);
  return "INSTALLED";
}
