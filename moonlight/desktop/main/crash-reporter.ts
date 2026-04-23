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

import { app, crashReporter } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface CrashEvent {
  id: string;
  at: string; // ISO timestamp
  kind:
    | 'backend-exit'
    | 'backend-spawn-failure'
    | 'main-uncaught'
    | 'renderer-crashed'
    | 'renderer-gone';
  message: string;
  context: Record<string, unknown>;
}

const MAX_HISTORY = 200;

export class CrashReporterService {
  private historyFile: string | null = null;
  private uploadUrl: string | null = null;
  private enabled = true;
  private history: CrashEvent[] = [];

  start(): void {
    try {
      this.uploadUrl = process.env.MOONLIGHT_CRASH_UPLOAD_URL || null;
      this.enabled = process.env.MOONLIGHT_CRASH_REPORTER_DISABLED !== 'true';

      if (!this.enabled) return;

      // Electron requires submitURL even with uploadToServer=false; we
      // use a sentinel that won't ever be hit.
      crashReporter.start({
        productName: 'MoonLight Owner Console',
        companyName: 'MoonLight Trading OS',
        submitURL:
          this.uploadUrl ??
          'https://example.invalid/moonlight-crash-sink-disabled',
        uploadToServer: Boolean(this.uploadUrl),
        ignoreSystemCrashHandler: false,
        rateLimit: true,
        compress: true,
        globalExtra: {
          app_version: app.getVersion(),
          channel: process.env.MOONLIGHT_UPDATE_CHANNEL ?? 'latest',
        },
      });

      // History file under userData/logs.
      const logsDir = path.join(app.getPath('userData'), 'logs');
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      this.historyFile = path.join(logsDir, 'crash-history.jsonl');
      this.loadHistory();
    } catch (err) {
      // Never crash on crash-reporter init.
      // eslint-disable-next-line no-console
      console.error('[crash-reporter] init failed:', (err as Error).message);
      this.enabled = false;
    }
  }

  private loadHistory(): void {
    if (!this.historyFile || !fs.existsSync(this.historyFile)) return;
    try {
      const lines = fs
        .readFileSync(this.historyFile, 'utf8')
        .split('\n')
        .filter((l) => l.trim().length);
      this.history = lines
        .slice(-MAX_HISTORY)
        .map((l) => {
          try {
            return JSON.parse(l) as CrashEvent;
          } catch {
            return null;
          }
        })
        .filter((e): e is CrashEvent => e !== null);
    } catch {
      this.history = [];
    }
  }

  private append(event: CrashEvent): void {
    this.history.push(event);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }
    if (!this.historyFile) return;
    try {
      fs.appendFileSync(this.historyFile, JSON.stringify(event) + '\n', {
        mode: 0o600,
      });
    } catch {
      /* best-effort */
    }
  }

  /** Public recorders. */
  record(event: Omit<CrashEvent, 'id' | 'at'>): CrashEvent {
    const full: CrashEvent = {
      id: `crash_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toISOString(),
      ...event,
    };
    this.append(full);
    return full;
  }

  recordBackendCrash(params: {
    code: number | null;
    signal: string | null;
    lastError: string | null;
    entry: string | null;
    logFile: string | null;
    uptimeMs: number | null;
  }): CrashEvent {
    return this.record({
      kind: params.code === null ? 'backend-spawn-failure' : 'backend-exit',
      message:
        params.lastError ??
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

  recordMainUncaught(err: unknown): CrashEvent {
    return this.record({
      kind: 'main-uncaught',
      message: (err as Error)?.message ?? String(err),
      context: { stack: (err as Error)?.stack ?? null },
    });
  }

  recordRendererCrash(
    kind: 'renderer-crashed' | 'renderer-gone',
    details: Record<string, unknown>,
  ): CrashEvent {
    return this.record({
      kind,
      message: (details.reason as string) ?? kind,
      context: details,
    });
  }

  getHistory(limit = 50): CrashEvent[] {
    return this.history.slice(-limit).reverse();
  }

  getStatus(): {
    enabled: boolean;
    uploadUrl: string | null;
    historyFile: string | null;
    historyCount: number;
  } {
    return {
      enabled: this.enabled,
      uploadUrl: this.uploadUrl,
      historyFile: this.historyFile,
      historyCount: this.history.length,
    };
  }

  /** Best-effort forward to backend `/api/crash/report` so server can correlate. */
  async forwardToBackend(
    event: CrashEvent,
    backendPort: number | null,
  ): Promise<void> {
    if (!backendPort) return;
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
    } catch {
      /* swallow */
    }
  }
}
