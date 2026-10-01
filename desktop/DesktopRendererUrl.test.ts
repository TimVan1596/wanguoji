import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { getDesktopDebugLaunchOptions, getDesktopRendererUrl } from "./DesktopRendererUrl";

describe("desktop renderer launch URL", () => {
  it("leaves normal desktop URLs free of diagnostics parameters", () => {
    expect(getDesktopRendererUrl("file:///app/dist/index.html")).toBe("file:///app/dist/index.html#/");
    expect(getDesktopRendererUrl("http://localhost:5173/")).toBe("http://localhost:5173/");
  });

  it("adds debug query before the production hash route", () => {
    expect(getDesktopRendererUrl("file:///app/dist/index.html", { debug: true }))
      .toBe("file:///app/dist/index.html?debug=1#/");
    expect(getDesktopRendererUrl("file:///app/dist/index.html", { debug: true, avatarRenderer: "plain" }))
      .toBe("file:///app/dist/index.html?debug=1&avatarRenderer=plain#/");
  });

  it("adds debug query to the Vite development URL", () => {
    expect(getDesktopRendererUrl("http://localhost:5173/", { debug: true }))
      .toBe("http://localhost:5173/?debug=1");
  });

  it("parses only app-private debug and avatar arguments", () => {
    expect(getDesktopDebugLaunchOptions(["--wanguoji-debug"])).toMatchObject({ debug: true });
    expect(getDesktopDebugLaunchOptions(["--debug"])).toMatchObject({ debug: false });
    const plainOptions = getDesktopDebugLaunchOptions(["--wanguoji-avatar-renderer=plain"]);
    expect(plainOptions).toMatchObject({ debug: true, avatarRenderer: "plain" });
    expect(getDesktopRendererUrl("file:///app/index.html", plainOptions))
      .toBe("file:///app/index.html?debug=1&avatarRenderer=plain#/");
    expect(getDesktopRendererUrl("file:///app/index.html", getDesktopDebugLaunchOptions(["--debug"])))
      .toBe("file:///app/index.html#/");
  });

  it("parses a portable app-private development server argument", () => {
    expect(getDesktopDebugLaunchOptions(["--wanguoji-dev-server=http://localhost:5173"]).devServerUrl)
      .toBe("http://localhost:5173");
  });

  it("keeps Electron debug scripts clear of reserved Node inspector flags", () => {
    const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      scripts: Record<string, string>;
    };
    for (const scriptName of ["desktop:start:debug", "desktop:start:debug:plain", "desktop:dev:debug", "desktop:dev:debug:plain"]) {
      expect(packageJson.scripts[scriptName]).toContain("--wanguoji-debug");
      expect(packageJson.scripts[scriptName]).not.toContain("--debug");
    }
    expect(packageJson.scripts["desktop:start:debug:plain"]).toContain("--wanguoji-avatar-renderer=plain");
    expect(packageJson.scripts["desktop:dev:debug:plain"]).toContain("--wanguoji-avatar-renderer=plain");
  });
});
