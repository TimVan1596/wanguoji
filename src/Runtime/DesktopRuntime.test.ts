import { describe, expect, it } from "vitest";
import { getGridGodRouterMode, getGridGodRuntimeMode } from "./DesktopRuntime";

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

describe("router mode", () => {
  it("uses HashRouter only for Desktop and defaults to BrowserRouter for Web", () => {
    expect(getGridGodRouterMode(true)).toBe("hash");
    expect(getGridGodRouterMode(false)).toBe("browser");
    expect(getGridGodRouterMode(getGridGodRuntimeMode(undefined) === "DESKTOP_CONTINUOUS")).toBe("browser");
  });
});
