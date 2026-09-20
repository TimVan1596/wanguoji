import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("gridGodDesktop", {
  isDesktop: true,
  platform: process.platform,
  electronVersion: process.versions.electron,
  sendHeartbeat: (payload: unknown) => {
    ipcRenderer.send("gridgod:renderer-heartbeat", payload);
  },
});
