"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainWindow = exports.backend = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const backend_manager_1 = require("./backend-manager");
const auto_updater_1 = require("./auto-updater");
const crash_reporter_1 = require("./crash-reporter");
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
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
const crashReporter = new crash_reporter_1.CrashReporterService();
const autoUpdater = new auto_updater_1.AutoUpdaterService();
const backend = new backend_manager_1.BackendManager({
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
        MOONLIGHT_PACKAGED: electron_1.app.isPackaged ? 'true' : 'false',
    },
});
exports.backend = backend;
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
    }
    catch {
        /* ignore */
    }
});
/**
 * Tiny helper: fetch the backend over loopback using Electron's `net`
 * client (faster than `fetch` in older Electrons + no CORS surprises).
 */
async function backendFetch(method, pathname, body) {
    const port = backend.getStatus().port;
    if (!port)
        throw new Error('backend not running');
    return new Promise((resolve, reject) => {
        const req = electron_1.net.request({
            method,
            url: `http://127.0.0.1:${port}${pathname}`,
        });
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('X-Moonlight-Actor', 'desktop-ui');
        let data = '';
        req.on('response', (res) => {
            res.on('data', (chunk) => (data += chunk.toString()));
            res.on('end', () => resolve({ status: res.statusCode ?? 500, body: data }));
            res.on('error', reject);
        });
        req.on('error', reject);
        if (body !== undefined)
            req.write(JSON.stringify(body));
        req.end();
    });
}
let mainWindow = null;
exports.mainWindow = mainWindow;
async function createWindow() {
    exports.mainWindow = mainWindow = new electron_1.BrowserWindow({
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
    }
    else {
        await mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist-renderer', 'index.html'));
    }
}
/**
 * IPC surface the renderer uses to discover the dynamic backend port.
 * (Ports can drift from the preferred 8001 when a user has another
 * MoonLight instance running; see BackendManager.pickFreePort.)
 */
function registerIpc() {
    electron_1.ipcMain.handle('moonlight:get-backend-port', () => backend.getStatus().port);
    electron_1.ipcMain.handle('moonlight:get-backend-status', () => backend.getStatus());
    electron_1.ipcMain.handle('moonlight:restart-backend', async () => {
        await backend.stop();
        const port = await backend.start();
        // Renderer should reload so its API client picks up the fresh port.
        mainWindow?.webContents.reload();
        return { port };
    });
    // v2.6-2: Vault pass-through. Every call is proxied over loopback to
    // /api/secrets which enforces the localhost-only guard + audits the
    // actor = "desktop-ui".
    electron_1.ipcMain.handle('moonlight:vault:health', async () => {
        const r = await backendFetch('GET', '/api/secrets/health');
        return safeJson(r);
    });
    electron_1.ipcMain.handle('moonlight:vault:list', async () => {
        const r = await backendFetch('GET', '/api/secrets');
        return safeJson(r);
    });
    electron_1.ipcMain.handle('moonlight:vault:has', async (_e, key) => {
        const safe = encodeURIComponent(String(key || ''));
        const r = await backendFetch('GET', `/api/secrets/${safe}/exists`);
        return safeJson(r);
    });
    electron_1.ipcMain.handle('moonlight:vault:set', async (_e, key, value) => {
        const safe = encodeURIComponent(String(key || ''));
        const r = await backendFetch('PUT', `/api/secrets/${safe}`, { value });
        return safeJson(r);
    });
    electron_1.ipcMain.handle('moonlight:vault:delete', async (_e, key) => {
        const safe = encodeURIComponent(String(key || ''));
        const r = await backendFetch('DELETE', `/api/secrets/${safe}`);
        return safeJson(r);
    });
    electron_1.ipcMain.handle('moonlight:vault:audit', async () => {
        const r = await backendFetch('GET', '/api/secrets/audit/trail');
        return safeJson(r);
    });
    // v2.6-4: Auto-update IPC surface.
    electron_1.ipcMain.handle('moonlight:update:status', () => autoUpdater.getStatus());
    electron_1.ipcMain.handle('moonlight:update:check', () => autoUpdater.checkForUpdates());
    electron_1.ipcMain.handle('moonlight:update:download', () => autoUpdater.downloadUpdate());
    electron_1.ipcMain.handle('moonlight:update:install', () => autoUpdater.quitAndInstall());
    // v2.6-4: Crash reporter IPC surface (reads local desktop history and
    // proxies to backend for the correlated view).
    electron_1.ipcMain.handle('moonlight:crash:status', () => crashReporter.getStatus());
    electron_1.ipcMain.handle('moonlight:crash:history', (_e, limit) => crashReporter.getHistory(typeof limit === 'number' ? limit : 50));
    electron_1.ipcMain.handle('moonlight:crash:backend-reports', async (_e, limit) => {
        const n = typeof limit === 'number' ? limit : 50;
        const r = await backendFetch('GET', `/api/crash/reports?limit=${n}`);
        return safeJson(r);
    });
    electron_1.ipcMain.handle('moonlight:crash:backend-stats', async () => {
        const r = await backendFetch('GET', '/api/crash/stats');
        return safeJson(r);
    });
    // V2.6-7 Runtime Flags surface (localhost-only backend API proxied via
    // Electron IPC so the renderer doesn't need direct HTTP to the port).
    electron_1.ipcMain.handle('moonlight:flags:list', async () => {
        const r = await backendFetch('GET', '/api/flags');
        return safeJson(r);
    });
    electron_1.ipcMain.handle('moonlight:flags:set', async (_e, name, value, actor, acknowledge_real_money = false) => {
        const r = await backendFetch('PUT', `/api/flags/${encodeURIComponent(name)}`, {
            value,
            actor,
            acknowledge_real_money,
        });
        return safeJson(r);
    });
    electron_1.ipcMain.handle('moonlight:flags:reset', async (_e, actor) => {
        const r = await backendFetch('POST', '/api/flags/reset', { actor });
        return safeJson(r);
    });
    electron_1.ipcMain.handle('moonlight:flags:audit', async () => {
        const r = await backendFetch('GET', '/api/flags/audit');
        return safeJson(r);
    });
}
function safeJson(r) {
    try {
        const parsed = JSON.parse(r.body);
        return { status: r.status, ...parsed };
    }
    catch {
        return { status: r.status, raw: r.body };
    }
}
electron_1.app.whenReady().then(async () => {
    // v2.6-4: start the native crash reporter before anything else so any
    // subsequent crash in this session gets captured.
    crashReporter.start();
    process.on('uncaughtException', (err) => {
        const event = crashReporter.recordMainUncaught(err);
        void crashReporter.forwardToBackend(event, backend.getStatus().port);
    });
    // v2.7.0: also capture unhandled promise rejections in the main process.
    process.on('unhandledRejection', (reason) => {
        const err = reason instanceof Error
            ? reason
            : new Error(`UnhandledRejection: ${String(reason)}`);
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
        }
        catch (err) {
            const event = crashReporter.record({
                kind: 'backend-spawn-failure',
                message: err.message,
                context: { entry: backend.getStatus().backendEntry },
            });
            void crashReporter.forwardToBackend(event, backend.getStatus().port);
            const status = backend.getStatus();
            electron_1.dialog.showErrorBox('MoonLight Backend failed to start', `${err.message}\n\n` +
                `Entry: ${status.backendEntry ?? 'n/a'}\nLog: ${status.logFile ?? 'n/a'}`);
            electron_1.app.quit();
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
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', async () => {
    await backend.stop();
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// Last-ditch shutdown guards — also cover the `electron --inspect-brk` dev
// path where `window-all-closed` never fires.
electron_1.app.on('before-quit', async (event) => {
    const status = backend.getStatus();
    if (!status.running)
        return;
    event.preventDefault();
    try {
        await backend.stop();
    }
    finally {
        electron_1.app.exit(0);
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
//# sourceMappingURL=index.js.map