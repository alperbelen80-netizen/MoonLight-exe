"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
/**
 * v2.6-1: preload bridge.
 *
 * The renderer can't import Node modules directly; everything has to go
 * through this whitelist.  We expose a tiny moonlight API so the frontend
 * can discover the dynamic backend port and trigger a restart from the
 * Settings UI (v2.6-2 will add credential vault operations here too).
 */
electron_1.contextBridge.exposeInMainWorld('api', {
    openExternal: (url) => electron_1.shell.openExternal(url),
    getVersion: () => process.versions.electron,
});
electron_1.contextBridge.exposeInMainWorld('moonlight', {
    getBackendPort: () => electron_1.ipcRenderer.invoke('moonlight:get-backend-port'),
    getBackendStatus: () => electron_1.ipcRenderer.invoke('moonlight:get-backend-status'),
    restartBackend: () => electron_1.ipcRenderer.invoke('moonlight:restart-backend'),
});
