import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../src/Persistence/WorldSaveSchema";
import { DESKTOP_PRODUCTION_CSP, getStableUserDataPath, injectDesktopCsp, isAllowedDesktopNavigation } from "./DesktopSecurity";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as any;
const mainSource = readFileSync(new URL("./main.ts", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("./preload.ts", import.meta.url), "utf8");

describe("Desktop packaging and renderer security", () => {
  it("declares stable packaging identity, entry point, asar and filtered runtime files", () => {
    expect(packageJson.main).toBe("desktop/dist/main.js");
    expect(packageJson.build).toMatchObject({
      appId: "io.github.timvan1596.wanguoji",
      productName: "万国纪 Wanguoji",
      executableName: "Wanguoji",
      asar: true,
    });
    expect(packageJson.build.files).toContain("dist/**");
    expect(packageJson.build.files).toContain("desktop/dist/**");
    expect(packageJson.build.files).toContain("!src/**");
    expect(packageJson.build.files).toContain("!docs/**");
    expect(packageJson.scripts["desktop:package"]).toContain("--dir");
    expect(packageJson.scripts["desktop:pack"]).toBe("pnpm desktop:package");
    expect(packageJson.scripts["desktop:dist:mac"]).toContain("--arm64");
    expect(packageJson.scripts["desktop:dist:win"]).toContain("--win nsis --x64");
    expect(packageJson.scripts["desktop:start:debug"]).toContain("desktop:renderer-debug-build");
    expect(packageJson.scripts["desktop:renderer-debug-build"]).toContain("--mode desktop-debug --sourcemap");
    expect(packageJson.scripts["desktop:renderer-build"]).toContain("--mode desktop");
    expect(packageJson.build.files).toContain("!**/*.map");
    expect(packageJson.version).toBe("0.99.100");
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(8);
  });

  it("restricts Desktop production CSP without weakening Web or script policy", () => {
    expect(DESKTOP_PRODUCTION_CSP).toContain("style-src 'self' 'unsafe-inline'");
    expect(DESKTOP_PRODUCTION_CSP).not.toMatch(/unsafe-eval|default-src\s+[^;]*\*/i);
    const injected = injectDesktopCsp("<html><head></head><body></body></html>");
    expect(injected).toContain('http-equiv="Content-Security-Policy"');
    expect(injectDesktopCsp(injected)).toBe(injected);
    expect(readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8"))
      .toContain("isDesktopBuildMode(mode)");
  });

  it("allows only the app document (or configured dev root) and denies external navigation", () => {
    const app = "file:///Applications/Wanguoji.app/Contents/Resources/app.asar/dist/index.html";
    expect(isAllowedDesktopNavigation(`${app}#/`, app)).toBe(true);
    expect(isAllowedDesktopNavigation("file:///tmp/other.html", app)).toBe(false);
    expect(isAllowedDesktopNavigation("https://example.com", app)).toBe(false);
    expect(isAllowedDesktopNavigation("http://localhost:5173/?debug=1", app, "http://localhost:5173/")).toBe(true);
    expect(isAllowedDesktopNavigation("http://localhost:5174/", app, "http://localhost:5173/")).toBe(false);
  });

  it("uses a stable application userData folder and preserves Electron security defaults", () => {
    expect(getStableUserDataPath("/Users/test/Library/Application Support")).toBe("/Users/test/Library/Application Support/Wanguoji");
    expect(mainSource).toMatch(/nodeIntegration:\s*false/);
    expect(mainSource).toMatch(/contextIsolation:\s*true/);
    expect(mainSource).toMatch(/sandbox:\s*true/);
    expect(mainSource).toMatch(/webSecurity:\s*true/);
    expect(mainSource).toMatch(/setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
    expect(mainSource).toContain('"will-navigate"');
  });

  it("does not expose raw Electron authority from preload", () => {
    expect(preloadSource).toContain("contextBridge.exposeInMainWorld");
    expect(preloadSource).not.toMatch(/exposeInMainWorld\([^,]+,\s*ipcRenderer/);
    expect(preloadSource).not.toMatch(/\b(?:require|fs|child_process|shell)\s*:/);
    expect(preloadSource).toContain('"gridgod:renderer-heartbeat"');
    expect(preloadSource).toContain('"gridgod:autosave-result"');
  });
});
