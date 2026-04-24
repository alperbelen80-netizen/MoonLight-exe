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
exports.CrashReporterService = void 0;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const MAX_HISTORY = 200;
class CrashReporterService {
    constructor() {
        this.historyFile = null;
        this.uploadUrl = null;
        this.enabled = true;
        this.history = [];
    }
    start() {
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
                submitURL: this.uploadUrl ??
                    'https://example.invalid/moonlight-crash-sink-disabled',
                uploadToServer: Boolean(this.uploadUrl),
                ignoreSystemCrashHandler: false,
                rateLimit: true,
                compress: true,
                globalExtra: {
                    app_version: electron_1.app.getVersion(),
                    channel: process.env.MOONLIGHT_UPDATE_CHANNEL ?? 'latest',
                },
            });
            // History file under userData/logs.
            const logsDir = path.join(electron_1.app.getPath('userData'), 'logs');
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
    }
    loadHistory() {
        if (!this.historyFile || !fs.existsSync(this.historyFile))
            return;
        try {
            const lines = fs
                .readFileSync(this.historyFile, 'utf8')
                .split('\n')
                .filter((l) => l.trim().length);
            this.history = lines
                .slice(-MAX_HISTORY)
                .map((l) => {
                try {
                    return JSON.parse(l);
                }
                catch {
                    return null;
                }
            })
                .filter((e) => e !== null);
        }
        catch {
            this.history = [];
        }
    }
    append(event) {
        this.history.push(event);
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(-MAX_HISTORY);
        }
        if (!this.historyFile)
            return;
        try {
            fs.appendFileSync(this.historyFile, JSON.stringify(event) + '\n', {
                mode: 0o600,
            });
        }
        catch {
            /* best-effort */
        }
    }
    /** Public recorders. */
    record(event) {
        const full = {
            id: `crash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            at: new Date().toISOString(),
            ...event,
        };
        this.append(full);
        return full;
    }
    recordBackendCrash(params) {
        return this.record({
            kind: params.code === null ? 'backend-spawn-failure' : 'backend-exit',
            message: params.lastError ??
                `backend exited (code=${params.code} signal=${params.signal})`,
            context: {
                code: params.code,
                signal: params.signal,
                entry: params.entry,
                logFile: params.logFile,
                uptimeMs: params.uptimeMs,
            },
        });
    }
    recordMainUncaught(err) {
        return this.record({
            kind: 'main-uncaught',
            message: err?.message ?? String(err),
            context: { stack: err?.stack ?? null },
        });
    }
    recordRendererCrash(kind, details) {
        return this.record({
            kind,
            message: details.reason ?? kind,
            context: details,
        });
    }
    getHistory(limit = 50) {
        return this.history.slice(-limit).reverse();
    }
    getStatus() {
        return {
            enabled: this.enabled,
            uploadUrl: this.uploadUrl,
            historyFile: this.historyFile,
            historyCount: this.history.length,
        };
    }
    /** Best-effort forward to backend `/api/crash/report` so server can correlate. */
    async forwardToBackend(event, backendPort) {
        if (!backendPort)
            return;
        try {
            // Using Node's http (keeps this module Electron-free for tests).
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const http = require('http');
            const payload = JSON.stringify(event);
            const req = http.request({
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
            req.on('error', () => {
                /* swallow — crash reporting must never cascade */
            });
            req.write(payload);
            req.end();
        }
        catch {
            /* swallow */
        }
    }
}
exports.CrashReporterService = CrashReporterService;
//# sourceMappingURL=crash-reporter.js.map