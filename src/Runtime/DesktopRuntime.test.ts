import { describe, expect, it } from "vitest";
import { getGridGodRuntimeMode } from "./DesktopRuntime";

describe("Wanguoji runtime mode", () => {
  it("uses WEB_CATCH_UP when the Electron preload bridge is absent", () => {
    expect(getGridGodRuntimeMode(undefined)).toBe("WEB_CATCH_UP");
    expect(getGridGodRuntimeMode({})).toBe("WEB_CATCH_UP");
  });

  it("uses DESKTOP_CONTINUOUS only when preload exposes the desktop marker", () => {
    expect(
      getGridGodRuntimeMode({
        gridGodDesktop: {
          isDesktop: true,
          platform: "darwin",
        },
      })
    ).toBe("DESKTOP_CONTINUOUS");
  });
});
