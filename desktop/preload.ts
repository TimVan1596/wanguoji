import { contextBridge, ipcRenderer } from "electron";

function subscribe<T>(channel: string, callback: (payload: T) => void) {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld("gridGodDesktop", {
  isDesktop: true,
  platform: process.platform,
  electronVersion: process.versions.electron,
  sendHeartbeat: (payload: unknown) => ipcRenderer.send("gridgod:renderer-heartbeat", payload),
  onAutosaveRequested: (callback: (payload: { requestId: string }) => void) =>
    subscribe("gridgod:autosave-request", callback),
  reportAutosaveResult: (payload: unknown) => ipcRenderer.send("gridgod:autosave-result", payload),
  onBeforeClose: (callback: () => void) =>
    subscribe("gridgod:before-close", () => callback()),
  reportCloseSaveResult: (payload: unknown) => ipcRenderer.send("gridgod:close-save-result", payload),
  onResumeAfterSuspend: (callback: (payload: unknown) => void) =>
    subscribe("gridgod:resume-after-suspend", callback),
  reportResumeCatchUpResult: (payload: unknown) => ipcRenderer.send("gridgod:resume-catch-up-result", payload),
  getDiagnostics: () => ipcRenderer.invoke("gridgod:get-desktop-diagnostics"),
  reportFatalRendererError: (report: string) => ipcRenderer.send("gridgod:fatal-renderer-error", report),
});
