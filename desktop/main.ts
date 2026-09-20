import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";

interface RendererHeartbeat {
  worldMonth?: number;
  fixedSteps?: number;
  physicsSteps?: number;
  catchUpDebtSteps?: number;
  documentVisibilityState?: string;
  focused?: boolean;
  timestamp?: number;
}

let mainWindow: BrowserWindow | undefined;
let latestHeartbeat: RendererHeartbeat | undefined;

function getAppRoot() {
  return path.resolve(__dirname, "../..");
}

function getPreloadPath() {
  return path.join(__dirname, "preload.js");
}

function getProductionIndexUrl() {
  return pathToFileURL(path.join(getAppRoot(), "dist", "index.html")).toString();
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 720,
    title: "万国纪 · Wanguoji Desktop Probe",
    backgroundColor: "#eef4e8",
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  });

  const devServerUrl = process.env.GRIDGOD_DESKTOP_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadURL(getProductionIndexUrl());
  }

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

ipcMain.on("gridgod:renderer-heartbeat", (_event, payload: RendererHeartbeat) => {
  latestHeartbeat = {
    ...payload,
    timestamp: typeof payload?.timestamp === "number" ? payload.timestamp : Date.now(),
  };
});

ipcMain.handle("gridgod:get-latest-heartbeat", () => latestHeartbeat);

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
