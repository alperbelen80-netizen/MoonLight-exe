export interface IElectronAPI {
  openExternal: (url: string) => Promise<void>;
  getVersion: () => string;
}

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
