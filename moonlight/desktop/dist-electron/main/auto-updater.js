"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoUpdaterService = void 0;
const electron_1 = require("electron");
const DEFAULT_OWNER = 'moonlight-trading';
const DEFAULT_REPO = 'moonlight-owner-console';
class AutoUpdaterService {
    constructor(opts = {}) {
        this.updater = null;
        this.state = 'idle';
        this.lastError = null;
        this.latestVersion = null;
        this.downloadPercent = 0;
        this.bytesPerSecond = 0;
        this.transferred = 0;
        this.total = 0;
        this.lastCheckedAtMs = null;
        this.feedUrl = null;
        this.owner = opts.owner ?? process.env.MOONLIGHT_UPDATE_OWNER ?? DEFAULT_OWNER;
        this.repo = opts.repo ?? process.env.MOONLIGHT_UPDATE_REPO ?? DEFAULT_REPO;
        this.channel = opts.channel ?? process.env.MOONLIGHT_UPDATE_CHANNEL ?? 'latest';
        this.forceEnable = opts.forceEnable ?? false;
        // In dev (non-packaged) we disable by default — electron-updater
        // refuses to run against an unpacked dev tree anyway.
        const envFlag = process.env.MOONLIGHT_AUTO_UPDATE_ENABLED;
        if (envFlag === 'false') {
            this.disabled = true;
        }
        else if (envFlag === 'true' || this.forceEnable) {
            this.disabled = false;
        }
        else {
            this.disabled = !electron_1.app?.isPackaged;
        }
        if (this.disabled) {
            this.state = 'disabled';
            this.lastError = electron_1.app?.isPackaged
                ? 'auto-update disabled by MOONLIGHT_AUTO_UPDATE_ENABLED=false'
                : 'auto-update disabled in dev (non-packaged app)';
        }
    }
    /** Lazy-load the electron-updater module. Safe across missing-dep. */
    loadUpdater() {
        if (this.updater)
            return this.updater;
        if (this.disabled)
            return null;
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const mod = require('electron-updater');
            const updater = mod.autoUpdater;
            updater.autoDownload = false; // user-confirmed
            updater.autoInstallOnAppQuit = false; // user-confirmed
            updater.allowDowngrade = false;
            updater.channel = this.channel;
            // GitHub feed — `publish: null` in electron-builder config means we
            // don't auto-publish from the build step; we point the runtime at
            // the releases manually here.
            const feed = {
                provider: 'github',
                owner: this.owner,
                repo: this.repo,
                vPrefixedTagName: true,
                releaseType: 'release',
            };
            updater.setFeedURL(feed);
            this.feedUrl = `https://github.com/${this.owner}/${this.repo}/releases/latest`;
            updater.on('checking-for-update', () => {
                this.state = 'checking';
                this.lastCheckedAtMs = Date.now();
            });
            updater.on('update-available', (info) => {
                this.state = 'available';
                const v = info?.version;
                if (v)
                    this.latestVersion = v;
            });
            updater.on('update-not-available', (info) => {
                this.state = 'not-available';
                const v = info?.version;
                if (v)
                    this.latestVersion = v;
            });
            updater.on('error', (err) => {
                this.state = 'error';
                this.lastError = err?.message ?? String(err);
            });
            updater.on('download-progress', (p) => {
                this.state = 'downloading';
                const pr = p;
                this.downloadPercent = pr.percent ?? 0;
                this.bytesPerSecond = pr.bytesPerSecond ?? 0;
                this.transferred = pr.transferred ?? 0;
                this.total = pr.total ?? 0;
            });
            updater.on('update-downloaded', (info) => {
                this.state = 'downloaded';
                const v = info?.version;
                if (v)
                    this.latestVersion = v;
            });
            this.updater = updater;
            return updater;
        }
        catch (err) {
            this.lastError = `electron-updater load failed: ${err.message}`;
            this.state = 'error';
            return null;
        }
    }
    getStatus() {
        return {
            available: !this.disabled,
            reason: this.disabled ? this.lastError : null,
            state: this.state,
            currentVersion: electron_1.app?.getVersion?.() ?? '0.0.0',
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
    async checkForUpdates() {
        if (this.disabled)
            return this.getStatus();
        const u = this.loadUpdater();
        if (!u)
            return this.getStatus();
        try {
            this.lastError = null;
            await u.checkForUpdates();
        }
        catch (err) {
            this.state = 'error';
            this.lastError = err.message;
        }
        return this.getStatus();
    }
    async downloadUpdate() {
        if (this.disabled)
            return this.getStatus();
        const u = this.loadUpdater();
        if (!u)
            return this.getStatus();
        if (this.state !== 'available') {
            this.lastError = `cannot download from state=${this.state}`;
            return this.getStatus();
        }
        try {
            await u.downloadUpdate();
        }
        catch (err) {
            this.state = 'error';
            this.lastError = err.message;
        }
        return this.getStatus();
    }
    quitAndInstall() {
        if (this.disabled)
            return this.getStatus();
        const u = this.loadUpdater();
        if (!u)
            return this.getStatus();
        if (this.state !== 'downloaded') {
            this.lastError = `cannot install from state=${this.state}`;
            return this.getStatus();
        }
        // Small delay lets the IPC reply return before the app dies.
        setTimeout(() => {
            try {
                u.quitAndInstall(false, true);
            }
            catch (err) {
                this.state = 'error';
                this.lastError = err.message;
            }
        }, 200);
        return this.getStatus();
    }
    /** Notify renderer of state changes (used for push-style updates). */
    broadcast(win) {
        try {
            win?.webContents.send('moonlight:update:status', this.getStatus());
        }
        catch {
            /* ignore */
        }
    }
}
exports.AutoUpdaterService = AutoUpdaterService;
//# sourceMappingURL=auto-updater.js.map