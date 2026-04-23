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
// MoonLight v2.6-1 — Electron Main Process
//
// Boots the Desktop shell AND the bundled NestJS backend together so a
// double-clicked installer "just works" on Windows. See backend-manager.ts
// for the lifecycle contract.
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
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
    },
});
exports.backend = backend;
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
}
electron_1.app.whenReady().then(async () => {
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
            const status = backend.getStatus();
            electron_1.dialog.showErrorBox('MoonLight Backend failed to start', `${err.message}\n\n` +
                `Entry: ${status.backendEntry ?? 'n/a'}\nLog: ${status.logFile ?? 'n/a'}`);
            electron_1.app.quit();
            return;
        }
    }
    await createWindow();
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
