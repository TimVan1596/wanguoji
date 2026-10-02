import { app, BrowserWindow, dialog, ipcMain, Menu, powerMonitor } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { getStableUserDataPath, isAllowedDesktopNavigation } from "./DesktopSecurity";
import { getDesktopDebugLaunchOptions, getDesktopRendererUrl } from "./DesktopRendererUrl";
import {
  decideSingleInstance,
  DesktopAutosaveGate,
  DesktopCloseHandshake,
} from "./DesktopLifecycleRules";

interface RendererHeartbeat {
  worldMonth?: number;
  fixedSteps?: number;
  physicsSteps?: number;
  catchUpDebtSteps?: number;
  documentVisibilityState?: string;
  focused?: boolean;
  running?: boolean;
  worldStarted?: boolean;
  selectedSpeed?: number;
  worldInstanceId?: number;
  catchUpTotalSteps?: number;
  catchUpCompletedSteps?: number;
  catchUpTruncated?: boolean;
  catchUpSource?: "NONE" | "WEB_VISIBILITY" | "DESKTOP_OS_RESUME";
  lastCatchUpSource?: "NONE" | "WEB_VISIBILITY" | "DESKTOP_OS_RESUME";
  backgroundMode?: "FOREGROUND" | "CATCH_UP";
  desktopVisibilityCatchUpInvariantViolation?: boolean;
  timestamp?: number;
}

interface AutosaveResult {
  requestId: string;
  status: "SAVED" | "SKIPPED" | "FAILED";
  reason?: string;
  worldMonth?: number;
  serializedBytes?: number;
  writeDurationMs?: number;
  waitSafeBoundaryMs?: number;
  exportSerializeMs?: number;
  indexedDbWriteMs?: number;
  totalSaveDurationMs?: number;
  savedAt?: string;
  error?: string;
}

interface DesktopDiagnostics {
  platform: string;
  focused: boolean;
  visibility: string;
  heartbeatAgeSeconds?: number;
  latestHeartbeat?: RendererHeartbeat;
  lastAutosaveResult?: AutosaveResult;
  suspendCount: number;
  lastSuspendDurationMs?: number;
  resumeCatchUp?: { steps: number; truncated: boolean; complete: boolean };
  rendererCrash?: { reason: string; exitCode: number; at: string };
  windowMinimized: boolean;
  minimizeCount: number;
  lastMinimizedAt?: string;
  lastRestoredAt?: string;
}

app.setName("Wanguoji");
app.setPath("userData", getStableUserDataPath(app.getPath("appData")));
const instanceLock = app.requestSingleInstanceLock();
const autosaveGate = new DesktopAutosaveGate();
const closeHandshake = new DesktopCloseHandshake();
const diagnostics: DesktopDiagnostics = {
  platform: process.platform,
  focused: true,
  visibility: "unknown",
  suspendCount: 0,
  windowMinimized: false,
  minimizeCount: 0,
};

let mainWindow: BrowserWindow | undefined;
let latestHeartbeat: RendererHeartbeat | undefined;
let closeAllowed = false;
let appQuitPending = false;
let closeTimeout: ReturnType<typeof setTimeout> | undefined;
let autosaveTimeout: ReturnType<typeof setTimeout> | undefined;
let pendingAutosaveId: string | undefined;
let suspendedAt: number | undefined;
let suspendHeartbeat: RendererHeartbeat | undefined;
let crashRecoveryReloadAttempted = false;

function getAppRoot() {
  return path.resolve(__dirname, "../..");
}

function getPreloadPath() {
  return path.join(__dirname, "preload.js");
}

function getProductionIndexUrl() {
  return pathToFileURL(path.join(getAppRoot(), "dist", "index.html")).toString();
}

function getRendererUrl(baseUrl: string) {
  const { debug, avatarRenderer, textureProbe } = getDesktopDebugLaunchOptions(process.argv);
  return getDesktopRendererUrl(baseUrl, { debug, avatarRenderer, textureProbe });
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function requestCloseSave() {
  if (closeHandshake.pending || closeTimeout) return;
  closeHandshake.begin(true);
  mainWindow?.webContents.send("gridgod:before-close");
  closeTimeout = setTimeout(() => {
    closeTimeout = undefined;
    if (closeHandshake.timeout() === "CANCEL") {
      appQuitPending = false;
      void showCloseFailure("保存超时，世界未保存，应用未关闭。");
    }
  }, 10_000);
}

async function createWindow() {
  const launchOptions = getDesktopDebugLaunchOptions(process.argv);
  const devServerUrl = launchOptions.devServerUrl
    ?? process.env.GRIDGOD_DESKTOP_DEV_SERVER_URL;
  const appUrl = devServerUrl ? getRendererUrl(devServerUrl) : getProductionIndexUrl();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: `万国纪 · Wanguoji${devServerUrl ? " [DEV]" : ""}`,
    backgroundColor: "#eef4e8",
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, destination) => {
    if (!isAllowedDesktopNavigation(destination, appUrl, devServerUrl)) {
      event.preventDefault();
      console.warn("[Wanguoji Desktop] blocked renderer navigation", destination);
    }
  });

  mainWindow.on("focus", () => { diagnostics.focused = true; });
  mainWindow.on("blur", () => { diagnostics.focused = false; });
  mainWindow.on("minimize", () => {
    diagnostics.windowMinimized = true;
    diagnostics.minimizeCount += 1;
    diagnostics.lastMinimizedAt = new Date().toISOString();
  });
  mainWindow.on("restore", () => {
    diagnostics.windowMinimized = false;
    diagnostics.lastRestoredAt = new Date().toISOString();
  });
  mainWindow.on("close", (event) => {
    if (closeAllowed) return;
    event.preventDefault();
    requestCloseSave();
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    diagnostics.rendererCrash = {
      reason: details.reason,
      exitCode: details.exitCode,
      at: new Date().toISOString(),
    };
    console.error("[Wanguoji] renderer process gone", {
      ...diagnostics.rendererCrash,
      latestHeartbeat,
      lastAutosaveResult: diagnostics.lastAutosaveResult,
    });
    if (!devServerUrl && !crashRecoveryReloadAttempted) {
      crashRecoveryReloadAttempted = true;
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
      }, 300);
    }
  });
  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error("[Wanguoji Desktop] did-fail-load", {
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame,
    });
  });
  mainWindow.webContents.on("console-message", (details) => {
    if (details.level === "error" || details.level === "warning") {
      const log = details.level === "error" ? console.error : console.warn;
      log("[Wanguoji Desktop] renderer console message", {
        level: details.level,
        message: details.message,
        sourceId: details.sourceId,
        lineNumber: details.lineNumber,
      });
    }
  });
  mainWindow.webContents.on("did-finish-load", () => {
    console.info("[Wanguoji Desktop] renderer loaded:", mainWindow?.webContents.getURL());
  });
  mainWindow.on("closed", () => { mainWindow = undefined; });

  if (devServerUrl) {
    await mainWindow.loadURL(appUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadURL(getRendererUrl(appUrl));
  }
}

function installApplicationMenu() {
  const isMac = process.platform === "darwin";
  const isDevelopment = Boolean(
    getDesktopDebugLaunchOptions(process.argv).devServerUrl || process.env.GRIDGOD_DESKTOP_DEV_SERVER_URL
  );
  const allowDevTools = isDevelopment || getDesktopDebugLaunchOptions(process.argv).debug;
  const viewMenu: Electron.MenuItemConstructorOptions[] = [
    { role: "reload" },
    { role: "forceReload" },
    { type: "separator" },
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
  ];
  if (allowDevTools) viewMenu.splice(2, 0, { role: "toggleDevTools" });
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: "万国纪 Wanguoji",
      submenu: [
        { role: "about" as const },
        { type: "separator" as const },
        { role: "hide" as const },
        { role: "hideOthers" as const },
        { role: "unhide" as const },
        { type: "separator" as const },
        { role: "quit" as const },
      ],
    }] : []),
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: viewMenu },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }] },
    { label: "Help", submenu: [{ label: "About Wanguoji", role: "about" }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function showCloseFailure(message: string) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  await dialog.showMessageBox(mainWindow, {
    type: "error",
    title: "万国纪未退出",
    message,
    detail: "请确认存档可用后重试关闭。为保护世界进度，本次关闭已取消。",
    buttons: ["返回世界"],
    defaultId: 0,
  });
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function sendAutosaveRequest() {
  const requestId = randomUUID();
  if (!autosaveGate.begin(requestId)) return;
  pendingAutosaveId = requestId;
  autosaveTimeout = setTimeout(() => {
    if (pendingAutosaveId !== requestId) return;
    pendingAutosaveId = undefined;
    autosaveGate.complete(requestId);
    diagnostics.lastAutosaveResult = {
      requestId,
      status: "FAILED",
      error: "自动保存请求超时（renderer 未响应）",
    };
  }, 30_000);
  if (!mainWindow || mainWindow.isDestroyed()) {
    autosaveGate.complete(requestId);
    pendingAutosaveId = undefined;
    clearTimeout(autosaveTimeout);
    autosaveTimeout = undefined;
    diagnostics.lastAutosaveResult = { requestId, status: "SKIPPED", reason: "NO_RENDERER" };
    return;
  }
  mainWindow.webContents.send("gridgod:autosave-request", { requestId });
}

ipcMain.on("gridgod:renderer-heartbeat", (_event, payload: RendererHeartbeat) => {
  if (!payload || typeof payload !== "object") return;
  latestHeartbeat = {
    ...payload,
    timestamp: typeof payload.timestamp === "number" ? payload.timestamp : Date.now(),
  };
  diagnostics.latestHeartbeat = latestHeartbeat;
  diagnostics.visibility = latestHeartbeat.documentVisibilityState ?? "unknown";
  diagnostics.focused = latestHeartbeat.focused ?? diagnostics.focused;
  if (diagnostics.resumeCatchUp && latestHeartbeat.catchUpDebtSteps === 0) {
    diagnostics.resumeCatchUp.complete = true;
  }
});

ipcMain.handle("gridgod:get-desktop-diagnostics", () => ({
  ...diagnostics,
  heartbeatAgeSeconds: latestHeartbeat?.timestamp === undefined
    ? undefined
    : Math.max(0, (Date.now() - latestHeartbeat.timestamp) / 1000),
}));

ipcMain.on("gridgod:autosave-result", (_event, result: AutosaveResult) => {
  if (!result || typeof result.requestId !== "string" || !autosaveGate.complete(result.requestId)) return;
  if (autosaveTimeout) clearTimeout(autosaveTimeout);
  autosaveTimeout = undefined;
  pendingAutosaveId = undefined;
  diagnostics.lastAutosaveResult = result;
});

ipcMain.on("gridgod:close-save-result", (_event, result: { status: "SAVED" | "FAILED" | "SKIPPED"; worldStarted?: boolean; error?: string }) => {
  if (!closeHandshake.pending) return;
  if (closeTimeout) clearTimeout(closeTimeout);
  closeTimeout = undefined;
  const decision = result?.status === "SKIPPED" && result.worldStarted === false
    ? closeHandshake.resolve("SAVED")
    : closeHandshake.resolve(result?.status ?? "FAILED");
  if (decision === "ALLOW") {
    closeAllowed = true;
    if (appQuitPending) app.quit();
    else mainWindow?.close();
    return;
  }
  void showCloseFailure(result?.error || "退出前保存失败，应用未关闭。");
});

ipcMain.on("gridgod:resume-catch-up-result", (_event, result: { status: "SCHEDULED" | "SKIPPED"; steps?: number; truncated?: boolean }) => {
  diagnostics.resumeCatchUp = {
    steps: Number.isFinite(result?.steps) ? Math.max(0, result.steps as number) : 0,
    truncated: Boolean(result?.truncated),
    complete: result?.status === "SKIPPED" || (result?.steps ?? 0) === 0,
  };
});

if (decideSingleInstance(instanceLock) === "QUIT") {
  app.quit();
} else {
  app.on("second-instance", () => focusMainWindow());
  app.on("before-quit", (event) => {
    if (closeAllowed) return;
    event.preventDefault();
    appQuitPending = true;
    requestCloseSave();
  });

  app.whenReady().then(async () => {
    installApplicationMenu();
    await createWindow();
    setInterval(sendAutosaveRequest, 5 * 60 * 1000);

    if (powerMonitor) {
      powerMonitor.on("suspend", () => {
        suspendedAt = Date.now();
        suspendHeartbeat = latestHeartbeat ? { ...latestHeartbeat } : undefined;
        diagnostics.suspendCount += 1;
      });
      powerMonitor.on("resume", () => {
        const resumedAt = Date.now();
        const elapsedRealMs = suspendedAt === undefined ? 0 : Math.max(0, resumedAt - suspendedAt);
        const heartbeat = suspendHeartbeat;
        suspendedAt = undefined;
        suspendHeartbeat = undefined;
        diagnostics.lastSuspendDurationMs = elapsedRealMs;
        mainWindow?.webContents.send("gridgod:resume-after-suspend", {
          elapsedRealMs,
          wasRunning: Boolean(heartbeat?.worldStarted && heartbeat.running),
          selectedSpeed: heartbeat?.selectedSpeed ?? 1,
          worldInstanceId: heartbeat?.worldInstanceId,
        });
      });
    }

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) await createWindow();
      else focusMainWindow();
    });
  });

  app.on("window-all-closed", () => app.quit());
}
