"use strict";
/**
 * MoonLight v2.6-4 — Electron + Backend Crash Reporter.
 *
 * Local-first crash reporting. No remote telemetry by default.
 * What it does:
 *   1. Boots Electron's native `crashReporter` with crashes written to
 *      `<userData>/Crashpad/`. Remote upload is DISABLED unless the
 *      operator sets `MOONLIGHT_CRASH_UPLOAD_URL` explicitly.
 *   2. Maintains a small ring-buffered "crash history" file at
 *      `<userData>/logs/crash-history.jsonl` containing structured
 *      events (backend exits, renderer crashes, uncaught main errors).
 *   3. Exposes `recordBackendCrash()` that `BackendManager` calls when
 *      the spawned backend dies unexpectedly. Renderer can list the
 *      history via IPC for the "About → Crash History" UI panel.
 *
 * Philosophy: deterministic, auditable, no hidden phone-home.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrashReporterService = void 0;
var electron_1 = require("electron");
var fs = require("fs");
var path = require("path");
var MAX_HISTORY = 200;
var CrashReporterService = /** @class */ (function () {
    function CrashReporterService() {
        this.historyFile = null;
        this.uploadUrl = null;
        this.enabled = true;
        this.history = [];
    }
    CrashReporterService.prototype.start = function () {
        var _a, _b;
        try {
            this.uploadUrl = process.env.MOONLIGHT_CRASH_UPLOAD_URL || null;
            this.enabled = process.env.MOONLIGHT_CRASH_REPORTER_DISABLED !== 'true';
            if (!this.enabled)
                return;
            // Electron requires submitURL even with uploadToServer=false; we
            // use a sentinel that won't ever be hit.
            electron_1.crashReporter.start({
                productName: 'MoonLight Owner Console',
                companyName: 'MoonLight Trading OS',
                submitURL: (_a = this.uploadUrl) !== null && _a !== void 0 ? _a : 'https://example.invalid/moonlight-crash-sink-disabled',
                uploadToServer: Boolean(this.uploadUrl),
                ignoreSystemCrashHandler: false,
                rateLimit: true,
                compress: true,
                globalExtra: {
                    app_version: electron_1.app.getVersion(),
                    channel: (_b = process.env.MOONLIGHT_UPDATE_CHANNEL) !== null && _b !== void 0 ? _b : 'latest',
                },
            });
            // History file under userData/logs.
            var logsDir = path.join(electron_1.app.getPath('userData'), 'logs');
            if (!fs.existsSync(logsDir))
                fs.mkdirSync(logsDir, { recursive: true });
            this.historyFile = path.join(logsDir, 'crash-history.jsonl');
            this.loadHistory();
        }
        catch (err) {
            // Never crash on crash-reporter init.
            // eslint-disable-next-line no-console
            console.error('[crash-reporter] init failed:', err.message);
            this.enabled = false;
        }
    };
    CrashReporterService.prototype.loadHistory = function () {
        if (!this.historyFile || !fs.existsSync(this.historyFile))
            return;
        try {
            var lines = fs
                .readFileSync(this.historyFile, 'utf8')
                .split('\n')
                .filter(function (l) { return l.trim().length; });
            this.history = lines
                .slice(-MAX_HISTORY)
                .map(function (l) {
                try {
                    return JSON.parse(l);
                }
                catch (_a) {
                    return null;
                }
            })
                .filter(function (e) { return e !== null; });
        }
        catch (_a) {
            this.history = [];
        }
    };
    CrashReporterService.prototype.append = function (event) {
        this.history.push(event);
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(-MAX_HISTORY);
        }
        if (!this.historyFile)
            return;
        try {
            fs.appendFileSync(this.historyFile, JSON.stringify(event) + '\n', {
                mode: 384,
            });
        }
        catch (_a) {
            /* best-effort */
        }
    };
    /** Public recorders. */
    CrashReporterService.prototype.record = function (event) {
        var full = __assign({ id: "crash_".concat(Date.now(), "_").concat(Math.random().toString(36).slice(2, 8)), at: new Date().toISOString() }, event);
        this.append(full);
        return full;
    };
    CrashReporterService.prototype.recordBackendCrash = function (params) {
        var _a;
        return this.record({
            kind: params.code === null ? 'backend-spawn-failure' : 'backend-exit',
            message: (_a = params.lastError) !== null && _a !== void 0 ? _a : "backend exited (code=".concat(params.code, " signal=").concat(params.signal, ")"),
            context: {
                code: params.code,
                signal: params.signal,
                entry: params.entry,
                logFile: params.logFile,
                uptimeMs: params.uptimeMs,
            },
        });
    };
    CrashReporterService.prototype.recordMainUncaught = function (err) {
        var _a, _b;
        return this.record({
            kind: 'main-uncaught',
            message: (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : String(err),
            context: { stack: (_b = err === null || err === void 0 ? void 0 : err.stack) !== null && _b !== void 0 ? _b : null },
        });
    };
    CrashReporterService.prototype.recordRendererCrash = function (kind, details) {
        var _a;
        return this.record({
            kind: kind,
            message: (_a = details.reason) !== null && _a !== void 0 ? _a : kind,
            context: details,
        });
    };
    CrashReporterService.prototype.getHistory = function (limit) {
        if (limit === void 0) { limit = 50; }
        return this.history.slice(-limit).reverse();
    };
    CrashReporterService.prototype.getStatus = function () {
        return {
            enabled: this.enabled,
            uploadUrl: this.uploadUrl,
            historyFile: this.historyFile,
            historyCount: this.history.length,
        };
    };
    /** Best-effort forward to backend `/api/crash/report` so server can correlate. */
    CrashReporterService.prototype.forwardToBackend = function (event, backendPort) {
        return __awaiter(this, void 0, void 0, function () {
            var http, payload, req;
            return __generator(this, function (_a) {
                if (!backendPort)
                    return [2 /*return*/];
                try {
                    http = require('http');
                    payload = JSON.stringify(event);
                    req = http.request({
                        host: '127.0.0.1',
                        port: backendPort,
                        method: 'POST',
                        path: '/api/crash/report',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(payload),
                            'X-Moonlight-Actor': 'desktop-crash-reporter',
                        },
                        timeout: 2000,
                    });
                    req.on('error', function () {
                        /* swallow — crash reporting must never cascade */
                    });
                    req.write(payload);
                    req.end();
                }
                catch (_b) {
                    /* swallow */
                }
                return [2 /*return*/];
            });
        });
    };
    return CrashReporterService;
}());
exports.CrashReporterService = CrashReporterService;
