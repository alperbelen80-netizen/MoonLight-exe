import { contextBridge, shell, ipcRenderer } from 'electron';

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
contextBridge.exposeInMainWorld('api', {
  openExternal: (url: string) => shell.openExternal(url),
  getVersion: () => process.versions.electron,
});

contextBridge.exposeInMainWorld('moonlight', {
  getBackendPort: () => ipcRenderer.invoke('moonlight:get-backend-port'),
  getBackendStatus: () => ipcRenderer.invoke('moonlight:get-backend-status'),
  restartBackend: () => ipcRenderer.invoke('moonlight:restart-backend'),

  vault: {
    health: () => ipcRenderer.invoke('moonlight:vault:health'),
    list: () => ipcRenderer.invoke('moonlight:vault:list'),
    has: (key: string) => ipcRenderer.invoke('moonlight:vault:has', key),
    set: (key: string, value: string) =>
      ipcRenderer.invoke('moonlight:vault:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('moonlight:vault:delete', key),
    audit: () => ipcRenderer.invoke('moonlight:vault:audit'),
  },

  // v2.6-4: Auto-updater surface. All methods return a UpdateStatus snapshot.
  updater: {
    status: () => ipcRenderer.invoke('moonlight:update:status'),
    check: () => ipcRenderer.invoke('moonlight:update:check'),
    download: () => ipcRenderer.invoke('moonlight:update:download'),
    install: () => ipcRenderer.invoke('moonlight:update:install'),
    onStatus: (cb: (status: unknown) => void) => {
      const listener = (_e: unknown, payload: unknown) => cb(payload);
      ipcRenderer.on('moonlight:update:status', listener);
      return () => ipcRenderer.removeListener('moonlight:update:status', listener);
    },
  },

  // v2.6-4: Crash reporter surface.
  crash: {
    status: () => ipcRenderer.invoke('moonlight:crash:status'),
    history: (limit?: number) =>
      ipcRenderer.invoke('moonlight:crash:history', limit),
    backendReports: (limit?: number) =>
      ipcRenderer.invoke('moonlight:crash:backend-reports', limit),
    backendStats: () => ipcRenderer.invoke('moonlight:crash:backend-stats'),
    onEvent: (cb: (event: unknown) => void) => {
      const listener = (_e: unknown, payload: unknown) => cb(payload);
      ipcRenderer.on('moonlight:crash:event', listener);
      return () => ipcRenderer.removeListener('moonlight:crash:event', listener);
    },
  },
});
