import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as net from 'net';
import { app } from 'electron';

/**
 * MoonLight v2.6-1 — BackendManager
 *
 * Owns the lifecycle of the bundled NestJS backend that ships alongside
 * the Electron Desktop app. Responsibilities:
 *
 *   1. Locate the bundled backend entry point (dev vs packaged paths).
 *   2. Allocate a free port (default 8001, fall back to the next free one).
 *   3. Spawn the backend using Electron's Node runtime
 *      (`process.execPath` + `ELECTRON_RUN_AS_NODE=1`) so no separate Node
 *      install is required on the user's machine.
 *   4. Wait for `/api/healthz` to go green, with a generous retry budget.
 *   5. Forward stdout/stderr to a rolling log file under
 *      `app.getPath('logs')` so post-mortem debugging is possible.
 *   6. Gracefully kill the backend on Electron app quit (SIGTERM → SIGKILL).
 *
 * The manager exposes a promise-based `start()` that resolves with the
 * chosen port. The renderer learns the port via a `get-backend-port` IPC
 * handler registered in `index.ts`.
 */

export interface BackendManagerOptions {
  preferredPort?: number;
  healthPath?: string;
  healthTimeoutMs?: number;
  healthRetryDelayMs?: number;
  healthMaxRetries?: number;
  extraEnv?: NodeJS.ProcessEnv;
  logFileName?: string;
}

export interface BackendStatus {
  running: boolean;
  port: number | null;
  pid: number | null;
  backendEntry: string | null;
  startedAtMs: number | null;
  lastError: string | null;
  logFile: string | null;
}

const DEFAULT_OPTIONS: Required<Omit<BackendManagerOptions, 'extraEnv'>> = {
  preferredPort: 8001,
  healthPath: '/api/healthz',
  healthTimeoutMs: 1500,
  healthRetryDelayMs: 1000,
  // 60 retries × 1s ≈ 60s boot budget. Nest + TypeORM bootstrap is ~10s
  // on a warm machine, so 60s covers cold starts on laptops too.
  healthMaxRetries: 60,
  logFileName: 'backend.log',
};

export class BackendManager {
  private proc: ChildProcess | null = null;
  private port: number | null = null;
  private startedAtMs: number | null = null;
  private lastError: string | null = null;
  private logFile: string | null = null;
  private logStream: fs.WriteStream | null = null;
  private backendEntry: string | null = null;
  private readonly opts: Required<Omit<BackendManagerOptions, 'extraEnv'>>;
  private readonly extraEnv: NodeJS.ProcessEnv;
  private shuttingDown = false;
  // v2.6-4: optional crash hook. Electron main wires this up to the
  // CrashReporterService so unexpected exits land in crash-history.jsonl
  // and optionally forward to backend /api/crash/report.
  private onUnexpectedExit:
    | ((params: {
        code: number | null;
        signal: string | null;
        lastError: string | null;
        entry: string | null;
        logFile: string | null;
        uptimeMs: number | null;
      }) => void)
    | null = null;

  constructor(options: BackendManagerOptions = {}) {
    this.opts = { ...DEFAULT_OPTIONS, ...options };
    this.extraEnv = options.extraEnv ?? {};
  }

  /** v2.6-4: register a crash hook. Called only for non-graceful exits. */
  setCrashHook(
    hook: (params: {
      code: number | null;
      signal: string | null;
      lastError: string | null;
      entry: string | null;
      logFile: string | null;
      uptimeMs: number | null;
    }) => void,
  ): void {
    this.onUnexpectedExit = hook;
  }

  getStatus(): BackendStatus {
    return {
      running: Boolean(this.proc && this.proc.exitCode === null),
      port: this.port,
      pid: this.proc?.pid ?? null,
      backendEntry: this.backendEntry,
      startedAtMs: this.startedAtMs,
      lastError: this.lastError,
      logFile: this.logFile,
    };
  }

  /**
   * Locate the bundled backend entry point.
   *
   * In dev the manager may be started from the source tree — the caller can
   * set `MOONLIGHT_BACKEND_ENTRY` to point at the built bundle. In a packaged
   * Electron app (electron-builder), the bundle lives under
   *   <appResources>/backend-bundle/backend.js
   *
   * `process.resourcesPath` is guaranteed to be defined in packaged apps.
   */
  private resolveBackendEntry(): string {
    const override = process.env.MOONLIGHT_BACKEND_ENTRY;
    if (override && fs.existsSync(override)) return override;

    const packagedPath = path.join(
      process.resourcesPath || '',
      'backend-bundle',
      'backend.js',
    );
    if (fs.existsSync(packagedPath)) return packagedPath;

    // Dev fallback: repo root/../dist-bundle/backend.js relative to this file.
    const devPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      'dist-bundle',
      'backend.js',
    );
    if (fs.existsSync(devPath)) return devPath;

    throw new Error(
      `backend bundle not found. Looked at ` +
        `MOONLIGHT_BACKEND_ENTRY=${override ?? '(unset)'}, ` +
        `${packagedPath}, ${devPath}`,
    );
  }

  /**
   * Bind-test a port: if `preferredPort` is free use it, else walk upwards.
   * Exposed as `protected` so tests can override the walking strategy.
   */
  protected async pickFreePort(preferred: number, tries = 20): Promise<number> {
    for (let i = 0; i < tries; i++) {
      const port = preferred + i;
      const free = await new Promise<boolean>((resolve) => {
        const s = net.createServer();
        s.once('error', () => resolve(false));
        s.once('listening', () => {
          s.close(() => resolve(true));
        });
        s.listen(port, '127.0.0.1');
      });
      if (free) return port;
    }
    throw new Error(
      `no free port found in [${preferred}, ${preferred + tries})`,
    );
  }

  private openLogStream(): void {
    try {
      const logsDir = app?.getPath ? app.getPath('logs') : path.resolve('.');
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      this.logFile = path.join(logsDir, this.opts.logFileName);
      this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
      const banner =
        `\n---- backend started @ ${new Date().toISOString()} ----\n`;
      this.logStream.write(banner);
    } catch (err) {
      // logs are best-effort; never block spawn on FS issues.
      this.logFile = null;
      this.logStream = null;
    }
  }

  /** Start the backend. Resolves with the bound port. */
  async start(): Promise<number> {
    if (this.proc && this.proc.exitCode === null) {
      return this.port!;
    }
    this.shuttingDown = false;
    this.lastError = null;
    this.backendEntry = this.resolveBackendEntry();
    this.port = await this.pickFreePort(this.opts.preferredPort);
    this.openLogStream();

    // Spawn using Electron's bundled Node (ELECTRON_RUN_AS_NODE=1 tells
    // the Electron binary to behave like plain Node).
    // CWD is set to the bundle directory so the backend's bundle-safe
    // config resolver finds `src/config/*.yaml` relative to backend.js.
    const bundleDir = path.dirname(this.backendEntry);
    // Electron's `app.getPath('userData')` is writable (roaming profile on
    // Windows, ~/.config on Linux, ~/Library/Application Support on macOS)
    // — we pass it so the backend can write SQLite, vault, logs etc
    // without ever touching the read-only install directory.
    const userDataDir = app?.getPath ? app.getPath('userData') : bundleDir;
    const env = {
      ...process.env,
      ...this.extraEnv,
      PORT: String(this.port),
      MOONLIGHT_PORT: String(this.port),
      NODE_ENV: process.env.NODE_ENV || 'production',
      ELECTRON_RUN_AS_NODE: '1',
      // Explicit config dir override — wins over CWD-based heuristics.
      MOONLIGHT_CONFIG_DIR: path.join(bundleDir, 'src'),
      // Writable per-user data dir — backend resolves DB path from this.
      MOONLIGHT_USER_DATA_DIR: userDataDir,
    };

    this.proc = spawn(process.execPath, [this.backendEntry], {
      env,
      cwd: bundleDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    this.startedAtMs = Date.now();

    if (this.proc.stdout && this.logStream) {
      this.proc.stdout.pipe(this.logStream, { end: false });
    }
    if (this.proc.stderr && this.logStream) {
      this.proc.stderr.pipe(this.logStream, { end: false });
    }

    this.proc.on('exit', (code, signal) => {
      const msg = `backend exited (code=${code} signal=${signal})`;
      const wasShutdown = this.shuttingDown;
      if (!wasShutdown) this.lastError = msg;
      try {
        this.logStream?.write(`\n[BackendManager] ${msg}\n`);
      } catch {
        /* ignore */
      }
      this.logStream?.end();
      this.logStream = null;
      const uptime = this.startedAtMs ? Date.now() - this.startedAtMs : null;
      const entry = this.backendEntry;
      const logFile = this.logFile;
      this.proc = null;
      // v2.6-4: surface crash to registered hook (CrashReporterService).
      if (!wasShutdown && this.onUnexpectedExit) {
        try {
          this.onUnexpectedExit({
            code,
            signal: signal ?? null,
            lastError: msg,
            entry,
            logFile,
            uptimeMs: uptime,
          });
        } catch {
          /* ignore — crash hooks must never cascade */
        }
      }
    });

    try {
      await this.waitForHealth();
    } catch (err) {
      this.lastError = (err as Error).message;
      await this.stop();
      throw err;
    }
    return this.port;
  }

  private async waitForHealth(): Promise<void> {
    for (let i = 0; i < this.opts.healthMaxRetries; i++) {
      // Bail out fast if the process already died.
      if (!this.proc || this.proc.exitCode !== null) {
        throw new Error(
          `backend crashed during startup (exit=${this.proc?.exitCode ?? 'n/a'})`,
        );
      }
      const ok = await this.httpGetOk(
        `http://127.0.0.1:${this.port}${this.opts.healthPath}`,
      );
      if (ok) return;
      await new Promise((r) => setTimeout(r, this.opts.healthRetryDelayMs));
    }
    throw new Error(
      `backend did not become healthy within ` +
        `${this.opts.healthMaxRetries * this.opts.healthRetryDelayMs}ms`,
    );
  }

  private httpGetOk(url: string): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(url, { timeout: this.opts.healthTimeoutMs }, (res) => {
        const ok = typeof res.statusCode === 'number' && res.statusCode < 500;
        // Drain + close so we don't leak sockets.
        res.resume();
        resolve(ok);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /** Stop the backend gracefully. SIGTERM → SIGKILL fallback after 5s. */
  async stop(graceMs = 5000): Promise<void> {
    this.shuttingDown = true;
    const p = this.proc;
    if (!p || p.exitCode !== null) {
      this.proc = null;
      return;
    }
    try {
      // Windows lacks POSIX signals; child_process .kill() uses taskkill
      // internally via TerminateProcess for most cases.
      p.kill('SIGTERM');
    } catch {
      /* ignore */
    }
    const exited = await new Promise<boolean>((resolve) => {
      const t = setTimeout(() => resolve(false), graceMs);
      p.once('exit', () => {
        clearTimeout(t);
        resolve(true);
      });
    });
    if (!exited) {
      try {
        p.kill('SIGKILL');
      } catch {
        /* ignore */
      }
    }
    this.proc = null;
  }
}
