"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainWindow = exports.backend = void 0;
var electron_1 = require("electron");
var path = require("path");
var backend_manager_1 = require("./backend-manager");
var auto_updater_1 = require("./auto-updater");
var crash_reporter_1 = require("./crash-reporter");
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
var isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
var crashReporter = new crash_reporter_1.CrashReporterService();
var autoUpdater = new auto_updater_1.AutoUpdaterService();
var backend = new backend_manager_1.BackendManager({
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
backend.setCrashHook(function (info) {
    var event = crashReporter.recordBackendCrash(info);
    var port = backend.getStatus().port;
    // Fire-and-forget; never throws.
    void crashReporter.forwardToBackend(event, port);
    try {
        mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.send('moonlight:crash:event', event);
    }
    catch (_a) {
        /* ignore */
    }
});
/**
 * Tiny helper: fetch the backend over loopback using Electron's `net`
 * client (faster than `fetch` in older Electrons + no CORS surprises).
 */
function backendFetch(method, pathname, body) {
    return __awaiter(this, void 0, void 0, function () {
        var port;
        return __generator(this, function (_a) {
            port = backend.getStatus().port;
            if (!port)
                throw new Error('backend not running');
            return [2 /*return*/, new Promise(function (resolve, reject) {
                    var req = electron_1.net.request({
                        method: method,
                        url: "http://127.0.0.1:".concat(port).concat(pathname),
                    });
                    req.setHeader('Content-Type', 'application/json');
                    req.setHeader('X-Moonlight-Actor', 'desktop-ui');
                    var data = '';
                    req.on('response', function (res) {
                        res.on('data', function (chunk) { return (data += chunk.toString()); });
                        res.on('end', function () { var _a; return resolve({ status: (_a = res.statusCode) !== null && _a !== void 0 ? _a : 500, body: data }); });
                        res.on('error', reject);
                    });
                    req.on('error', reject);
                    if (body !== undefined)
                        req.write(JSON.stringify(body));
                    req.end();
                })];
        });
    });
}
var mainWindow = null;
exports.mainWindow = mainWindow;
function createWindow() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
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
                    mainWindow.once('ready-to-show', function () { return mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.show(); });
                    if (!isDev) return [3 /*break*/, 2];
                    return [4 /*yield*/, mainWindow.loadURL('http://localhost:5173')];
                case 1:
                    _a.sent();
                    mainWindow.webContents.openDevTools();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, mainWindow.loadFile(path.join(__dirname, '..', '..', 'dist-renderer', 'index.html'))];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
/**
 * IPC surface the renderer uses to discover the dynamic backend port.
 * (Ports can drift from the preferred 8001 when a user has another
 * MoonLight instance running; see BackendManager.pickFreePort.)
 */
function registerIpc() {
    var _this = this;
    electron_1.ipcMain.handle('moonlight:get-backend-port', function () { return backend.getStatus().port; });
    electron_1.ipcMain.handle('moonlight:get-backend-status', function () { return backend.getStatus(); });
    electron_1.ipcMain.handle('moonlight:restart-backend', function () { return __awaiter(_this, void 0, void 0, function () {
        var port;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backend.stop()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, backend.start()];
                case 2:
                    port = _a.sent();
                    // Renderer should reload so its API client picks up the fresh port.
                    mainWindow === null || mainWindow === void 0 ? void 0 : mainWindow.webContents.reload();
                    return [2 /*return*/, { port: port }];
            }
        });
    }); });
    // v2.6-2: Vault pass-through. Every call is proxied over loopback to
    // /api/secrets which enforces the localhost-only guard + audits the
    // actor = "desktop-ui".
    electron_1.ipcMain.handle('moonlight:vault:health', function () { return __awaiter(_this, void 0, void 0, function () {
        var r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendFetch('GET', '/api/secrets/health')];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
    electron_1.ipcMain.handle('moonlight:vault:list', function () { return __awaiter(_this, void 0, void 0, function () {
        var r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendFetch('GET', '/api/secrets')];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
    electron_1.ipcMain.handle('moonlight:vault:has', function (_e, key) { return __awaiter(_this, void 0, void 0, function () {
        var safe, r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    safe = encodeURIComponent(String(key || ''));
                    return [4 /*yield*/, backendFetch('GET', "/api/secrets/".concat(safe, "/exists"))];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
    electron_1.ipcMain.handle('moonlight:vault:set', function (_e, key, value) { return __awaiter(_this, void 0, void 0, function () {
        var safe, r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    safe = encodeURIComponent(String(key || ''));
                    return [4 /*yield*/, backendFetch('PUT', "/api/secrets/".concat(safe), { value: value })];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
    electron_1.ipcMain.handle('moonlight:vault:delete', function (_e, key) { return __awaiter(_this, void 0, void 0, function () {
        var safe, r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    safe = encodeURIComponent(String(key || ''));
                    return [4 /*yield*/, backendFetch('DELETE', "/api/secrets/".concat(safe))];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
    electron_1.ipcMain.handle('moonlight:vault:audit', function () { return __awaiter(_this, void 0, void 0, function () {
        var r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendFetch('GET', '/api/secrets/audit/trail')];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
    // v2.6-4: Auto-update IPC surface.
    electron_1.ipcMain.handle('moonlight:update:status', function () { return autoUpdater.getStatus(); });
    electron_1.ipcMain.handle('moonlight:update:check', function () { return autoUpdater.checkForUpdates(); });
    electron_1.ipcMain.handle('moonlight:update:download', function () { return autoUpdater.downloadUpdate(); });
    electron_1.ipcMain.handle('moonlight:update:install', function () { return autoUpdater.quitAndInstall(); });
    // v2.6-4: Crash reporter IPC surface (reads local desktop history and
    // proxies to backend for the correlated view).
    electron_1.ipcMain.handle('moonlight:crash:status', function () { return crashReporter.getStatus(); });
    electron_1.ipcMain.handle('moonlight:crash:history', function (_e, limit) {
        return crashReporter.getHistory(typeof limit === 'number' ? limit : 50);
    });
    electron_1.ipcMain.handle('moonlight:crash:backend-reports', function (_e, limit) { return __awaiter(_this, void 0, void 0, function () {
        var n, r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    n = typeof limit === 'number' ? limit : 50;
                    return [4 /*yield*/, backendFetch('GET', "/api/crash/reports?limit=".concat(n))];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
    electron_1.ipcMain.handle('moonlight:crash:backend-stats', function () { return __awaiter(_this, void 0, void 0, function () {
        var r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendFetch('GET', '/api/crash/stats')];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
    // V2.6-7 Runtime Flags surface (localhost-only backend API proxied via
    // Electron IPC so the renderer doesn't need direct HTTP to the port).
    electron_1.ipcMain.handle('moonlight:flags:list', function () { return __awaiter(_this, void 0, void 0, function () {
        var r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendFetch('GET', '/api/flags')];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
    electron_1.ipcMain.handle('moonlight:flags:set', function (_e_1, name_1, value_1, actor_1) {
        var args_1 = [];
        for (var _i = 4; _i < arguments.length; _i++) {
            args_1[_i - 4] = arguments[_i];
        }
        return __awaiter(_this, __spreadArray([_e_1, name_1, value_1, actor_1], args_1, true), void 0, function (_e, name, value, actor, acknowledge_real_money) {
            var r;
            if (acknowledge_real_money === void 0) { acknowledge_real_money = false; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, backendFetch('PUT', "/api/flags/".concat(encodeURIComponent(name)), {
                            value: value,
                            actor: actor,
                            acknowledge_real_money: acknowledge_real_money,
                        })];
                    case 1:
                        r = _a.sent();
                        return [2 /*return*/, safeJson(r)];
                }
            });
        });
    });
    electron_1.ipcMain.handle('moonlight:flags:reset', function (_e, actor) { return __awaiter(_this, void 0, void 0, function () {
        var r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendFetch('POST', '/api/flags/reset', { actor: actor })];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
    electron_1.ipcMain.handle('moonlight:flags:audit', function () { return __awaiter(_this, void 0, void 0, function () {
        var r;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, backendFetch('GET', '/api/flags/audit')];
                case 1:
                    r = _a.sent();
                    return [2 /*return*/, safeJson(r)];
            }
        });
    }); });
}
function safeJson(r) {
    try {
        var parsed = JSON.parse(r.body);
        return __assign({ status: r.status }, parsed);
    }
    catch (_a) {
        return { status: r.status, raw: r.body };
    }
}
electron_1.app.whenReady().then(function () { return __awaiter(void 0, void 0, void 0, function () {
    var shouldSpawnBackend, port, err_1, event_1, status_1;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                // v2.6-4: start the native crash reporter before anything else so any
                // subsequent crash in this session gets captured.
                crashReporter.start();
                process.on('uncaughtException', function (err) {
                    var event = crashReporter.recordMainUncaught(err);
                    void crashReporter.forwardToBackend(event, backend.getStatus().port);
                });
                registerIpc();
                shouldSpawnBackend = !isDev || process.env.MOONLIGHT_SPAWN_BACKEND === 'true';
                if (!shouldSpawnBackend) return [3 /*break*/, 4];
                _c.label = 1;
            case 1:
                _c.trys.push([1, 3, , 4]);
                return [4 /*yield*/, backend.start()];
            case 2:
                port = _c.sent();
                // eslint-disable-next-line no-console
                console.log("[main] backend up on port ".concat(port));
                return [3 /*break*/, 4];
            case 3:
                err_1 = _c.sent();
                event_1 = crashReporter.record({
                    kind: 'backend-spawn-failure',
                    message: err_1.message,
                    context: { entry: backend.getStatus().backendEntry },
                });
                void crashReporter.forwardToBackend(event_1, backend.getStatus().port);
                status_1 = backend.getStatus();
                electron_1.dialog.showErrorBox('MoonLight Backend failed to start', "".concat(err_1.message, "\n\n") +
                    "Entry: ".concat((_a = status_1.backendEntry) !== null && _a !== void 0 ? _a : 'n/a', "\nLog: ").concat((_b = status_1.logFile) !== null && _b !== void 0 ? _b : 'n/a'));
                electron_1.app.quit();
                return [2 /*return*/];
            case 4: return [4 /*yield*/, createWindow()];
            case 5:
                _c.sent();
                // v2.6-4: wire renderer-side crash events into the local reporter.
                if (mainWindow) {
                    mainWindow.webContents.on('render-process-gone', function (_e, details) {
                        var event = crashReporter.recordRendererCrash('renderer-gone', {
                            reason: details.reason,
                            exitCode: details.exitCode,
                        });
                        void crashReporter.forwardToBackend(event, backend.getStatus().port);
                    });
                    mainWindow.webContents.on('unresponsive', function () {
                        crashReporter.record({
                            kind: 'renderer-crashed',
                            message: 'renderer became unresponsive',
                            context: {},
                        });
                    });
                }
                electron_1.app.on('activate', function () {
                    if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                        createWindow();
                    }
                });
                return [2 /*return*/];
        }
    });
}); });
electron_1.app.on('window-all-closed', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, backend.stop()];
            case 1:
                _a.sent();
                if (process.platform !== 'darwin') {
                    electron_1.app.quit();
                }
                return [2 /*return*/];
        }
    });
}); });
// Last-ditch shutdown guards — also cover the `electron --inspect-brk` dev
// path where `window-all-closed` never fires.
electron_1.app.on('before-quit', function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var status;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                status = backend.getStatus();
                if (!status.running)
                    return [2 /*return*/];
                event.preventDefault();
                _a.label = 1;
            case 1:
                _a.trys.push([1, , 3, 4]);
                return [4 /*yield*/, backend.stop()];
            case 2:
                _a.sent();
                return [3 /*break*/, 4];
            case 3:
                electron_1.app.exit(0);
                return [7 /*endfinally*/];
            case 4: return [2 /*return*/];
        }
    });
}); });
process.on('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, backend.stop()];
            case 1:
                _a.sent();
                process.exit(0);
                return [2 /*return*/];
        }
    });
}); });
process.on('SIGTERM', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, backend.stop()];
            case 1:
                _a.sent();
                process.exit(0);
                return [2 /*return*/];
        }
    });
}); });
