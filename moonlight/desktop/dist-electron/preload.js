"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
/**
 * v2.6-2: preload bridge.
 *
 * The renderer can't import Node modules directly; everything has to go
 * through this whitelist.
 *
 * `moonlight.vault` is a **thin pass-through** to the backend's
 * /api/secrets REST surface. We keep the vault flow in the backend
 * because:
 *   1. It's already sandboxed (localhost-only controller).
 *   2. Centralising secret reads prevents the renderer from learning
 *      the AES key material (which lives server-side only).
 * The renderer still calls these methods via IPC so that in the future
 * we can swap the transport (eg. to IPC-native messages) without
 * touching call sites.
 */
electron_1.contextBridge.exposeInMainWorld('api', {
    openExternal: function (url) { return electron_1.shell.openExternal(url); },
    getVersion: function () { return process.versions.electron; },
});
electron_1.contextBridge.exposeInMainWorld('moonlight', {
    getBackendPort: function () { return electron_1.ipcRenderer.invoke('moonlight:get-backend-port'); },
    getBackendStatus: function () { return electron_1.ipcRenderer.invoke('moonlight:get-backend-status'); },
    restartBackend: function () { return electron_1.ipcRenderer.invoke('moonlight:restart-backend'); },
    vault: {
        health: function () { return electron_1.ipcRenderer.invoke('moonlight:vault:health'); },
        list: function () { return electron_1.ipcRenderer.invoke('moonlight:vault:list'); },
        has: function (key) { return electron_1.ipcRenderer.invoke('moonlight:vault:has', key); },
        set: function (key, value) {
            return electron_1.ipcRenderer.invoke('moonlight:vault:set', key, value);
        },
        delete: function (key) { return electron_1.ipcRenderer.invoke('moonlight:vault:delete', key); },
        audit: function () { return electron_1.ipcRenderer.invoke('moonlight:vault:audit'); },
    },
});
