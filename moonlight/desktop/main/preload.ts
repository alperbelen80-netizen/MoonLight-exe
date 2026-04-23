import { contextBridge, shell, ipcRenderer } from 'electron';

/**
 * v2.6-1: preload bridge.
 *
 * The renderer can't import Node modules directly; everything has to go
 * through this whitelist.  We expose a tiny moonlight API so the frontend
 * can discover the dynamic backend port and trigger a restart from the
 * Settings UI (v2.6-2 will add credential vault operations here too).
 */
contextBridge.exposeInMainWorld('api', {
  openExternal: (url: string) => shell.openExternal(url),
  getVersion: () => process.versions.electron,
});

contextBridge.exposeInMainWorld('moonlight', {
  getBackendPort: () => ipcRenderer.invoke('moonlight:get-backend-port'),
  getBackendStatus: () => ipcRenderer.invoke('moonlight:get-backend-status'),
  restartBackend: () => ipcRenderer.invoke('moonlight:restart-backend'),
});
