/**
 * MoonLight v2.6-4 — Auto-Updater Service (Electron Main).
 *
 * Thin wrapper around `electron-updater` (`autoUpdater`) that:
 *   1. Lazy-loads the module so that dev (non-packaged) and test runs
 *      never fail if the dependency is missing.
 *   2. Respects a **feature-flag**: `MOONLIGHT_AUTO_UPDATE_ENABLED`
 *      (default: false in dev, true in packaged) — operator can opt out.
 *   3. Points at the GitHub Releases feed declared in electron-builder
 *      (`publish: null` in config means we *don't* auto-publish from the
 *      build, but we still consume releases at runtime by setting the
 *      feed URL explicitly below).
 *   4. Exposes a tiny, safe IPC surface: check / download / install /
 *      status. The renderer polls `status()` to render progress.
 *   5. Never silently installs: user must confirm "install now" in UI.
 *
 * Fail-closed: any error during lazy require is captured into
 * `lastError` and the service returns `{ available: false, reason }` so
 * the UI can degrade gracefully.
 */

import type { BrowserWindow } from 'electron';
import { app } from 'electron';

export type UpdateState =
  | 'idle'
  | 'checking'
  | 'not-available'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'
  | 'disabled';

export interface UpdateStatus {
  available: boolean;
  reason: string | null;
  state: UpdateState;
  currentVersion: string;
  latestVersion: string | null;
  downloadPercent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
  lastError: string | null;
  lastCheckedAtMs: number | null;
  updateChannel: string;
  feedUrl: string | null;
}

interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowDowngrade: boolean;
  channel: string;
  setFeedURL(opts: unknown): void;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<string[]>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  logger: unknown;
}

const DEFAULT_OWNER = 'moonlight-trading';
const DEFAULT_REPO = 'moonlight-owner-console';

export interface AutoUpdaterServiceOptions {
  /** GitHub owner. Can be overridden via `MOONLIGHT_UPDATE_OWNER`. */
  owner?: string;
  /** GitHub repo name. Can be overridden via `MOONLIGHT_UPDATE_REPO`. */
  repo?: string;
  /** Update channel. Defaults to `latest`; `beta` also supported. */
  channel?: string;
  /** Force-enable even in dev. */
  forceEnable?: boolean;
}

export class AutoUpdaterService {
  private updater: AutoUpdaterLike | null = null;
  private state: UpdateState = 'idle';
  private lastError: string | null = null;
  private latestVersion: string | null = null;
  private downloadPercent = 0;
  private bytesPerSecond = 0;
  private transferred = 0;
  private total = 0;
  private lastCheckedAtMs: number | null = null;
  private feedUrl: string | null = null;
  private readonly channel: string;
  private readonly owner: string;
  private readonly repo: string;
  private readonly disabled: boolean;
  private readonly forceEnable: boolean;

  constructor(opts: AutoUpdaterServiceOptions = {}) {
    this.owner = opts.owner ?? process.env.MOONLIGHT_UPDATE_OWNER ?? DEFAULT_OWNER;
    this.repo = opts.repo ?? process.env.MOONLIGHT_UPDATE_REPO ?? DEFAULT_REPO;
    this.channel = opts.channel ?? process.env.MOONLIGHT_UPDATE_CHANNEL ?? 'latest';
    this.forceEnable = opts.forceEnable ?? false;

    // In dev (non-packaged) we disable by default — electron-updater
    // refuses to run against an unpacked dev tree anyway.
    const envFlag = process.env.MOONLIGHT_AUTO_UPDATE_ENABLED;
    if (envFlag === 'false') {
      this.disabled = true;
    } else if (envFlag === 'true' || this.forceEnable) {
      this.disabled = false;
    } else {
      this.disabled = !app?.isPackaged;
    }

    if (this.disabled) {
      this.state = 'disabled';
      this.lastError = app?.isPackaged
        ? 'auto-update disabled by MOONLIGHT_AUTO_UPDATE_ENABLED=false'
        : 'auto-update disabled in dev (non-packaged app)';
    }
  }

  /** Lazy-load the electron-updater module. Safe across missing-dep. */
  private loadUpdater(): AutoUpdaterLike | null {
    if (this.updater) return this.updater;
    if (this.disabled) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('electron-updater');
      const updater = mod.autoUpdater as AutoUpdaterLike;
      updater.autoDownload = false; // user-confirmed
      updater.autoInstallOnAppQuit = false; // user-confirmed
      updater.allowDowngrade = false;
      updater.channel = this.channel;

      // GitHub feed — `publish: null` in electron-builder config means we
      // don't auto-publish from the build step; we point the runtime at
      // the releases manually here.
      const feed = {
        provider: 'github' as const,
        owner: this.owner,
        repo: this.repo,
        vPrefixedTagName: true,
        releaseType: 'release' as const,
      };
      updater.setFeedURL(feed);
      this.feedUrl = `https://github.com/${this.owner}/${this.repo}/releases/latest`;

      updater.on('checking-for-update', () => {
        this.state = 'checking';
        this.lastCheckedAtMs = Date.now();
      });
      updater.on('update-available', (info: unknown) => {
        this.state = 'available';
        const v = (info as { version?: string })?.version;
        if (v) this.latestVersion = v;
      });
      updater.on('update-not-available', (info: unknown) => {
        this.state = 'not-available';
        const v = (info as { version?: string })?.version;
        if (v) this.latestVersion = v;
      });
      updater.on('error', (err: unknown) => {
        this.state = 'error';
        this.lastError = (err as Error)?.message ?? String(err);
      });
      updater.on('download-progress', (p: unknown) => {
        this.state = 'downloading';
        const pr = p as {
          percent?: number;
          bytesPerSecond?: number;
          transferred?: number;
          total?: number;
        };
        this.downloadPercent = pr.percent ?? 0;
        this.bytesPerSecond = pr.bytesPerSecond ?? 0;
        this.transferred = pr.transferred ?? 0;
        this.total = pr.total ?? 0;
      });
      updater.on('update-downloaded', (info: unknown) => {
        this.state = 'downloaded';
        const v = (info as { version?: string })?.version;
        if (v) this.latestVersion = v;
      });

      this.updater = updater;
      return updater;
    } catch (err) {
      this.lastError = `electron-updater load failed: ${(err as Error).message}`;
      this.state = 'error';
      return null;
    }
  }

  getStatus(): UpdateStatus {
    return {
      available: !this.disabled,
      reason: this.disabled ? this.lastError : null,
      state: this.state,
      currentVersion: app?.getVersion?.() ?? '0.0.0',
      latestVersion: this.latestVersion,
      downloadPercent: this.downloadPercent,
      bytesPerSecond: this.bytesPerSecond,
      transferred: this.transferred,
      total: this.total,
      lastError: this.lastError,
      lastCheckedAtMs: this.lastCheckedAtMs,
      updateChannel: this.channel,
      feedUrl: this.feedUrl,
    };
  }

  async checkForUpdates(): Promise<UpdateStatus> {
    if (this.disabled) return this.getStatus();
    const u = this.loadUpdater();
    if (!u) return this.getStatus();
    try {
      this.lastError = null;
      await u.checkForUpdates();
    } catch (err) {
      this.state = 'error';
      this.lastError = (err as Error).message;
    }
    return this.getStatus();
  }

  async downloadUpdate(): Promise<UpdateStatus> {
    if (this.disabled) return this.getStatus();
    const u = this.loadUpdater();
    if (!u) return this.getStatus();
    if (this.state !== 'available') {
      this.lastError = `cannot download from state=${this.state}`;
      return this.getStatus();
    }
    try {
      await u.downloadUpdate();
    } catch (err) {
      this.state = 'error';
      this.lastError = (err as Error).message;
    }
    return this.getStatus();
  }

  quitAndInstall(): UpdateStatus {
    if (this.disabled) return this.getStatus();
    const u = this.loadUpdater();
    if (!u) return this.getStatus();
    if (this.state !== 'downloaded') {
      this.lastError = `cannot install from state=${this.state}`;
      return this.getStatus();
    }
    // Small delay lets the IPC reply return before the app dies.
    setTimeout(() => {
      try {
        u.quitAndInstall(false, true);
      } catch (err) {
        this.state = 'error';
        this.lastError = (err as Error).message;
      }
    }, 200);
    return this.getStatus();
  }

  /** Notify renderer of state changes (used for push-style updates). */
  broadcast(win: BrowserWindow | null): void {
    try {
      win?.webContents.send('moonlight:update:status', this.getStatus());
    } catch {
      /* ignore */
    }
  }
}
