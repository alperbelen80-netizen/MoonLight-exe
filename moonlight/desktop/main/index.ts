import { app, BrowserWindow, ipcMain, dialog, net as electronNet } from 'electron';
import * as path from 'path';
import { BackendManager, BackendStatus } from './backend-manager';
import { AutoUpdaterService } from './auto-updater';
import { CrashReporterService } from './crash-reporter';

// MoonLight v2.6-4 — Electron Main Process
//
// Boots the Desktop shell AND the bundled NestJS backend together so a
// double-clicked installer "just works" on Windows. Also bridges the
// localhost-only /api/secrets surface into the renderer via IPC so the
// Settings UI can manage credentials without the renderer needing direct
// HTTP access to the vault API.
//
// v2.6-4 additions:
//   - `AutoUpdaterService` (electron-updater wrapper) for GitHub
//     Releases feed; feature-flagged and fail-safe.
//   - `CrashReporterService` writes crashes to <userData>/logs and
//     forwards to backend /api/crash/report for correlation.

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const crashReporter = new CrashReporterService();
const autoUpdater = new AutoUpdaterService();

const backend = new BackendManager({
  preferredPort: 8001,
  extraEnv: {
    // Fail-safe defaults survive into packaged installs: live pump OFF,
    // real broker paths OFF, DOM automation OFF. Operators flip these
    // from the Settings UI (v2.6-2 credential vault) before live trading.
    LIVE_SIGNAL_ENABLED: 'false',
    LIVE_SIGNAL_AUTO_START: 'false',
    BROKER_IQOPTION_REAL_ENABLED: 'false',
    BROKER_DOM_AUTOMATION_ENABLED: 'false',
    BROKER_DOM_LIVE_ORDERS: 'false',
    // v2.6-2: in a packaged install, plaintext .env credentials are
    // refused by BrokerCredentialsService. Operators MUST populate the
    // vault from the Settings UI before live trading.
    MOONLIGHT_PACKAGED: app.isPackaged ? 'true' : 'false',
  },
});

// v2.6-4: when the backend dies unexpectedly, log it and try to forward
// to its own /api/crash/report on whichever port it was bound to (or, if
// it's already dead, we just keep the local history file).
backend.setCrashHook((info) => {
  const event = crashReporter.recordBackendCrash(info);
  const port = backend.getStatus().port;
  // Fire-and-forget; never throws.
  void crashReporter.forwardToBackend(event, port);
  try {
    mainWindow?.webContents.send('moonlight:crash:event', event);
  } catch {
    /* ignore */
  }
});

/**
 * Tiny helper: fetch the backend over loopback using Electron's `net`
 * client (faster than `fetch` in older Electrons + no CORS surprises).
 */
async function backendFetch(
  method: string,
  pathname: string,
  body?: unknown,
): Promise<{ status: number; body: string }> {
  const port = backend.getStatus().port;
  if (!port) throw new Error('backend not running');
  return new Promise((resolve, reject) => {
    const req = electronNet.request({
      method,
      url: `http://127.0.0.1:${port}${pathname}`,
    });
    req.setHeader('Content-Type', 'application/json');
    req.setHeader('X-Moonlight-Actor', 'desktop-ui');
    let data = '';
    req.on('response', (res) => {
      res.on('data', (chunk) => (data += chunk.toString()));
      res.on('end', () =>
        resolve({ status: res.statusCode ?? 500, body: data }),
      );
      res.on('error', reject);
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

let mainWindow: BrowserWindow | null = null;

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'MoonLight Owner Console',
    show: false,
  });

  // Show the window only after the first paint so users don't see a flash
  // of unstyled content while the backend is warming up.
  mainWindow.once('ready-to-show', () => mainWindow?.show());

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, '..', '..', 'dist-renderer', 'index.html'),
    );
  }
}

/**
 * IPC surface the renderer uses to discover the dynamic backend port.
 * (Ports can drift from the preferred 8001 when a user has another
 * MoonLight instance running; see BackendManager.pickFreePort.)
 */
function registerIpc(): void {
  ipcMain.handle('moonlight:get-backend-port', () => backend.getStatus().port);
  ipcMain.handle('moonlight:get-backend-status', () => backend.getStatus());
  ipcMain.handle('moonlight:restart-backend', async () => {
    await backend.stop();
    const port = await backend.start();
    // Renderer should reload so its API client picks up the fresh port.
    mainWindow?.webContents.reload();
    return { port };
  });

  // v2.6-2: Vault pass-through. Every call is proxied over loopback to
  // /api/secrets which enforces the localhost-only guard + audits the
  // actor = "desktop-ui".
  ipcMain.handle('moonlight:vault:health', async () => {
    const r = await backendFetch('GET', '/api/secrets/health');
    return safeJson(r);
  });
  ipcMain.handle('moonlight:vault:list', async () => {
    const r = await backendFetch('GET', '/api/secrets');
    return safeJson(r);
  });
  ipcMain.handle('moonlight:vault:has', async (_e, key: string) => {
    const safe = encodeURIComponent(String(key || ''));
    const r = await backendFetch('GET', `/api/secrets/${safe}/exists`);
    return safeJson(r);
  });
  ipcMain.handle(
    'moonlight:vault:set',
    async (_e, key: string, value: string) => {
      const safe = encodeURIComponent(String(key || ''));
      const r = await backendFetch('PUT', `/api/secrets/${safe}`, { value });
      return safeJson(r);
    },
  );
  ipcMain.handle('moonlight:vault:delete', async (_e, key: string) => {
    const safe = encodeURIComponent(String(key || ''));
    const r = await backendFetch('DELETE', `/api/secrets/${safe}`);
    return safeJson(r);
  });
  ipcMain.handle('moonlight:vault:audit', async () => {
    const r = await backendFetch('GET', '/api/secrets/audit/trail');
    return safeJson(r);
  });

  // v2.6-4: Auto-update IPC surface.
  ipcMain.handle('moonlight:update:status', () => autoUpdater.getStatus());
  ipcMain.handle('moonlight:update:check', () => autoUpdater.checkForUpdates());
  ipcMain.handle('moonlight:update:download', () => autoUpdater.downloadUpdate());
  ipcMain.handle('moonlight:update:install', () => autoUpdater.quitAndInstall());

  // v2.6-4: Crash reporter IPC surface (reads local desktop history and
  // proxies to backend for the correlated view).
  ipcMain.handle('moonlight:crash:status', () => crashReporter.getStatus());
  ipcMain.handle('moonlight:crash:history', (_e, limit?: number) =>
    crashReporter.getHistory(typeof limit === 'number' ? limit : 50),
  );
  ipcMain.handle('moonlight:crash:backend-reports', async (_e, limit?: number) => {
    const n = typeof limit === 'number' ? limit : 50;
    const r = await backendFetch('GET', `/api/crash/reports?limit=${n}`);
    return safeJson(r);
  });
  ipcMain.handle('moonlight:crash:backend-stats', async () => {
    const r = await backendFetch('GET', '/api/crash/stats');
    return safeJson(r);
  });

  // V2.6-7 Runtime Flags surface (localhost-only backend API proxied via
  // Electron IPC so the renderer doesn't need direct HTTP to the port).
  ipcMain.handle('moonlight:flags:list', async () => {
    const r = await backendFetch('GET', '/api/flags');
    return safeJson(r);
  });
  ipcMain.handle(
    'moonlight:flags:set',
    async (
      _e,
      name: string,
      value: string,
      actor: string,
      acknowledge_real_money = false,
    ) => {
      const r = await backendFetch('PUT', `/api/flags/${encodeURIComponent(name)}`, {
        value,
        actor,
        acknowledge_real_money,
      });
      return safeJson(r);
    },
  );
  ipcMain.handle('moonlight:flags:reset', async (_e, actor: string) => {
    const r = await backendFetch('POST', '/api/flags/reset', { actor });
    return safeJson(r);
  });
  ipcMain.handle('moonlight:flags:audit', async () => {
    const r = await backendFetch('GET', '/api/flags/audit');
    return safeJson(r);
  });
}

function safeJson(r: { status: number; body: string }): unknown {
  try {
    const parsed = JSON.parse(r.body);
    return { status: r.status, ...parsed };
  } catch {
    return { status: r.status, raw: r.body };
  }
}

app.whenReady().then(async () => {
  // v2.6-4: start the native crash reporter before anything else so any
  // subsequent crash in this session gets captured.
  crashReporter.start();

  process.on('uncaughtException', (err) => {
    const event = crashReporter.recordMainUncaught(err);
    void crashReporter.forwardToBackend(event, backend.getStatus().port);
  });

  registerIpc();

  // In dev mode the operator typically runs `yarn backend:dev` in a
  // separate shell, so we don't spawn a second backend on top.
  const shouldSpawnBackend = !isDev || process.env.MOONLIGHT_SPAWN_BACKEND === 'true';

  if (shouldSpawnBackend) {
    try {
      const port = await backend.start();
      // eslint-disable-next-line no-console
      console.log(`[main] backend up on port ${port}`);
    } catch (err) {
      const event = crashReporter.record({
        kind: 'backend-spawn-failure',
        message: (err as Error).message,
        context: { entry: backend.getStatus().backendEntry },
      });
      void crashReporter.forwardToBackend(event, backend.getStatus().port);
      const status = backend.getStatus();
      dialog.showErrorBox(
        'MoonLight Backend failed to start',
        `${(err as Error).message}\n\n` +
          `Entry: ${status.backendEntry ?? 'n/a'}\nLog: ${status.logFile ?? 'n/a'}`,
      );
      app.quit();
      return;
    }
  }

  await createWindow();

  // v2.6-4: wire renderer-side crash events into the local reporter.
  if (mainWindow) {
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      const event = crashReporter.recordRendererCrash('renderer-gone', {
        reason: details.reason,
        exitCode: details.exitCode,
      });
      void crashReporter.forwardToBackend(event, backend.getStatus().port);
    });
    mainWindow.webContents.on('unresponsive', () => {
      crashReporter.record({
        kind: 'renderer-crashed',
        message: 'renderer became unresponsive',
        context: {},
      });
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await backend.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Last-ditch shutdown guards — also cover the `electron --inspect-brk` dev
// path where `window-all-closed` never fires.
app.on('before-quit', async (event) => {
  const status = backend.getStatus();
  if (!status.running) return;
  event.preventDefault();
  try {
    await backend.stop();
  } finally {
    app.exit(0);
  }
});

process.on('SIGINT', async () => {
  await backend.stop();
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await backend.stop();
  process.exit(0);
});

export { backend, mainWindow };
