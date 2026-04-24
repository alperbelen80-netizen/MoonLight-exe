"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
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
    openExternal: (url) => electron_1.shell.openExternal(url),
    getVersion: () => process.versions.electron,
});
electron_1.contextBridge.exposeInMainWorld('moonlight', {
    getBackendPort: () => electron_1.ipcRenderer.invoke('moonlight:get-backend-port'),
    getBackendStatus: () => electron_1.ipcRenderer.invoke('moonlight:get-backend-status'),
    restartBackend: () => electron_1.ipcRenderer.invoke('moonlight:restart-backend'),
    vault: {
        health: () => electron_1.ipcRenderer.invoke('moonlight:vault:health'),
        list: () => electron_1.ipcRenderer.invoke('moonlight:vault:list'),
        has: (key) => electron_1.ipcRenderer.invoke('moonlight:vault:has', key),
        set: (key, value) => electron_1.ipcRenderer.invoke('moonlight:vault:set', key, value),
        delete: (key) => electron_1.ipcRenderer.invoke('moonlight:vault:delete', key),
        audit: () => electron_1.ipcRenderer.invoke('moonlight:vault:audit'),
    },
    // v2.6-4: Auto-updater surface. All methods return a UpdateStatus snapshot.
    updater: {
        status: () => electron_1.ipcRenderer.invoke('moonlight:update:status'),
        check: () => electron_1.ipcRenderer.invoke('moonlight:update:check'),
        download: () => electron_1.ipcRenderer.invoke('moonlight:update:download'),
        install: () => electron_1.ipcRenderer.invoke('moonlight:update:install'),
        onStatus: (cb) => {
            const listener = (_e, payload) => cb(payload);
            electron_1.ipcRenderer.on('moonlight:update:status', listener);
            return () => electron_1.ipcRenderer.removeListener('moonlight:update:status', listener);
        },
    },
    // v2.6-4: Crash reporter surface.
    crash: {
        status: () => electron_1.ipcRenderer.invoke('moonlight:crash:status'),
        history: (limit) => electron_1.ipcRenderer.invoke('moonlight:crash:history', limit),
        backendReports: (limit) => electron_1.ipcRenderer.invoke('moonlight:crash:backend-reports', limit),
        backendStats: () => electron_1.ipcRenderer.invoke('moonlight:crash:backend-stats'),
        onEvent: (cb) => {
            const listener = (_e, payload) => cb(payload);
            electron_1.ipcRenderer.on('moonlight:crash:event', listener);
            return () => electron_1.ipcRenderer.removeListener('moonlight:crash:event', listener);
        },
    },
    // v2.6-7: Runtime Flags surface (in-app live trading safety switches).
    flags: {
        list: () => electron_1.ipcRenderer.invoke('moonlight:flags:list'),
        set: (name, value, actor, acknowledgeRealMoney = false) => electron_1.ipcRenderer.invoke('moonlight:flags:set', name, value, actor, acknowledgeRealMoney),
        reset: (actor) => electron_1.ipcRenderer.invoke('moonlight:flags:reset', actor),
        audit: () => electron_1.ipcRenderer.invoke('moonlight:flags:audit'),
    },
});
//# sourceMappingURL=preload.js.map