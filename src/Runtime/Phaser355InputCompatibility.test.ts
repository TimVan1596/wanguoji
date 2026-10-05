import { describe, expect, it, vi } from "vitest";
import { installPhaser355InputCompatibility, PhaserInputPluginPrototype } from "./Phaser355InputCompatibility";

function pluginPrototype(): PhaserInputPluginPrototype {
  return { sortGameObjects: (objects) => objects };
}

describe("Phaser 3.55.2 input compatibility backport", () => {
  it("returns the input list unchanged when a multi-object pointer has no camera", () => {
    const prototype = pluginPrototype();
    installPhaser355InputCompatibility("3.55.2", prototype);
    const objects = [{ id: "a" }, { id: "b" }];
    expect(prototype.sortGameObjects(objects, {})).toBe(objects);
    expect(objects.map(({ id }) => id)).toEqual(["a", "b"]);
    const single = [objects[0]];
    expect(prototype.sortGameObjects(single, {})).toBe(single);
  });

  it("sorts interactive objects in descending camera render order", () => {
    const prototype = pluginPrototype();
    installPhaser355InputCompatibility("3.55.2", prototype);
    const a = { id: "a" }, b = { id: "b" }, c = { id: "c" };
    const objects = [a, c, b];
    expect(prototype.sortGameObjects(objects, { camera: { renderList: [a, b, c] } }).map(({ id }) => id))
      .toEqual(["c", "b", "a"]);
  });

  it("uses upstream index-zero semantics for objects absent from renderList", () => {
    const prototype = pluginPrototype();
    installPhaser355InputCompatibility("3.55.2", prototype);
    const missing = { id: "missing" }, visible = { id: "visible" }, behind = { id: "behind" };
    expect(prototype.sortGameObjects([missing, visible], { camera: { renderList: [behind, visible] } }).map(({ id }) => id))
      .toEqual(["visible", "missing"]);
  });

  it("installs once per prototype and does not wrap it again", () => {
    const prototype = pluginPrototype();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(installPhaser355InputCompatibility("3.55.2", prototype)).toBe("INSTALLED");
    const installed = prototype.sortGameObjects;
    expect(installPhaser355InputCompatibility("3.55.2", prototype)).toBe("ALREADY_INSTALLED");
    expect(prototype.sortGameObjects).toBe(installed);
    expect(installPhaser355InputCompatibility("3.60.0", prototype)).toBe("UNSUPPORTED_VERSION");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
