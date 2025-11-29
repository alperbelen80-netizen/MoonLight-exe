import { contextBridge, shell } from 'electron';

contextBridge.exposeInMainWorld('api', {
  openExternal: (url: string) => shell.openExternal(url),
  getVersion: () => process.versions.electron,
});
