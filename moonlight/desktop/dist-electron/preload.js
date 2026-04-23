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
    // v2.6-4: Auto-updater surface. All methods return a UpdateStatus snapshot.
    updater: {
        status: function () { return electron_1.ipcRenderer.invoke('moonlight:update:status'); },
        check: function () { return electron_1.ipcRenderer.invoke('moonlight:update:check'); },
        download: function () { return electron_1.ipcRenderer.invoke('moonlight:update:download'); },
        install: function () { return electron_1.ipcRenderer.invoke('moonlight:update:install'); },
        onStatus: function (cb) {
            var listener = function (_e, payload) { return cb(payload); };
            electron_1.ipcRenderer.on('moonlight:update:status', listener);
            return function () { return electron_1.ipcRenderer.removeListener('moonlight:update:status', listener); };
        },
    },
    // v2.6-4: Crash reporter surface.
    crash: {
        status: function () { return electron_1.ipcRenderer.invoke('moonlight:crash:status'); },
        history: function (limit) {
            return electron_1.ipcRenderer.invoke('moonlight:crash:history', limit);
        },
        backendReports: function (limit) {
            return electron_1.ipcRenderer.invoke('moonlight:crash:backend-reports', limit);
        },
        backendStats: function () { return electron_1.ipcRenderer.invoke('moonlight:crash:backend-stats'); },
        onEvent: function (cb) {
            var listener = function (_e, payload) { return cb(payload); };
            electron_1.ipcRenderer.on('moonlight:crash:event', listener);
            return function () { return electron_1.ipcRenderer.removeListener('moonlight:crash:event', listener); };
        },
    },
    // v2.6-7: Runtime Flags surface (in-app live trading safety switches).
    flags: {
        list: function () { return electron_1.ipcRenderer.invoke('moonlight:flags:list'); },
        set: function (name, value, actor, acknowledgeRealMoney) {
            if (acknowledgeRealMoney === void 0) { acknowledgeRealMoney = false; }
            return electron_1.ipcRenderer.invoke('moonlight:flags:set', name, value, actor, acknowledgeRealMoney);
        },
        reset: function (actor) { return electron_1.ipcRenderer.invoke('moonlight:flags:reset', actor); },
        audit: function () { return electron_1.ipcRenderer.invoke('moonlight:flags:audit'); },
    },
});
