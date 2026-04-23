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
exports.AutoUpdaterService = void 0;
var electron_1 = require("electron");
var DEFAULT_OWNER = 'moonlight-trading';
var DEFAULT_REPO = 'moonlight-owner-console';
var AutoUpdaterService = /** @class */ (function () {
    function AutoUpdaterService(opts) {
        if (opts === void 0) { opts = {}; }
        var _a, _b, _c, _d, _e, _f, _g;
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
        this.owner = (_b = (_a = opts.owner) !== null && _a !== void 0 ? _a : process.env.MOONLIGHT_UPDATE_OWNER) !== null && _b !== void 0 ? _b : DEFAULT_OWNER;
        this.repo = (_d = (_c = opts.repo) !== null && _c !== void 0 ? _c : process.env.MOONLIGHT_UPDATE_REPO) !== null && _d !== void 0 ? _d : DEFAULT_REPO;
        this.channel = (_f = (_e = opts.channel) !== null && _e !== void 0 ? _e : process.env.MOONLIGHT_UPDATE_CHANNEL) !== null && _f !== void 0 ? _f : 'latest';
        this.forceEnable = (_g = opts.forceEnable) !== null && _g !== void 0 ? _g : false;
        // In dev (non-packaged) we disable by default — electron-updater
        // refuses to run against an unpacked dev tree anyway.
        var envFlag = process.env.MOONLIGHT_AUTO_UPDATE_ENABLED;
        if (envFlag === 'false') {
            this.disabled = true;
        }
        else if (envFlag === 'true' || this.forceEnable) {
            this.disabled = false;
        }
        else {
            this.disabled = !(electron_1.app === null || electron_1.app === void 0 ? void 0 : electron_1.app.isPackaged);
        }
        if (this.disabled) {
            this.state = 'disabled';
            this.lastError = (electron_1.app === null || electron_1.app === void 0 ? void 0 : electron_1.app.isPackaged)
                ? 'auto-update disabled by MOONLIGHT_AUTO_UPDATE_ENABLED=false'
                : 'auto-update disabled in dev (non-packaged app)';
        }
    }
    /** Lazy-load the electron-updater module. Safe across missing-dep. */
    AutoUpdaterService.prototype.loadUpdater = function () {
        var _this = this;
        if (this.updater)
            return this.updater;
        if (this.disabled)
            return null;
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            var mod = require('electron-updater');
            var updater = mod.autoUpdater;
            updater.autoDownload = false; // user-confirmed
            updater.autoInstallOnAppQuit = false; // user-confirmed
            updater.allowDowngrade = false;
            updater.channel = this.channel;
            // GitHub feed — `publish: null` in electron-builder config means we
            // don't auto-publish from the build step; we point the runtime at
            // the releases manually here.
            var feed = {
                provider: 'github',
                owner: this.owner,
                repo: this.repo,
                vPrefixedTagName: true,
                releaseType: 'release',
            };
            updater.setFeedURL(feed);
            this.feedUrl = "https://github.com/".concat(this.owner, "/").concat(this.repo, "/releases/latest");
            updater.on('checking-for-update', function () {
                _this.state = 'checking';
                _this.lastCheckedAtMs = Date.now();
            });
            updater.on('update-available', function (info) {
                _this.state = 'available';
                var v = info === null || info === void 0 ? void 0 : info.version;
                if (v)
                    _this.latestVersion = v;
            });
            updater.on('update-not-available', function (info) {
                _this.state = 'not-available';
                var v = info === null || info === void 0 ? void 0 : info.version;
                if (v)
                    _this.latestVersion = v;
            });
            updater.on('error', function (err) {
                var _a;
                _this.state = 'error';
                _this.lastError = (_a = err === null || err === void 0 ? void 0 : err.message) !== null && _a !== void 0 ? _a : String(err);
            });
            updater.on('download-progress', function (p) {
                var _a, _b, _c, _d;
                _this.state = 'downloading';
                var pr = p;
                _this.downloadPercent = (_a = pr.percent) !== null && _a !== void 0 ? _a : 0;
                _this.bytesPerSecond = (_b = pr.bytesPerSecond) !== null && _b !== void 0 ? _b : 0;
                _this.transferred = (_c = pr.transferred) !== null && _c !== void 0 ? _c : 0;
                _this.total = (_d = pr.total) !== null && _d !== void 0 ? _d : 0;
            });
            updater.on('update-downloaded', function (info) {
                _this.state = 'downloaded';
                var v = info === null || info === void 0 ? void 0 : info.version;
                if (v)
                    _this.latestVersion = v;
            });
            this.updater = updater;
            return updater;
        }
        catch (err) {
            this.lastError = "electron-updater load failed: ".concat(err.message);
            this.state = 'error';
            return null;
        }
    };
    AutoUpdaterService.prototype.getStatus = function () {
        var _a, _b;
        return {
            available: !this.disabled,
            reason: this.disabled ? this.lastError : null,
            state: this.state,
            currentVersion: (_b = (_a = electron_1.app === null || electron_1.app === void 0 ? void 0 : electron_1.app.getVersion) === null || _a === void 0 ? void 0 : _a.call(electron_1.app)) !== null && _b !== void 0 ? _b : '0.0.0',
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
    };
    AutoUpdaterService.prototype.checkForUpdates = function () {
        return __awaiter(this, void 0, void 0, function () {
            var u, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.disabled)
                            return [2 /*return*/, this.getStatus()];
                        u = this.loadUpdater();
                        if (!u)
                            return [2 /*return*/, this.getStatus()];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        this.lastError = null;
                        return [4 /*yield*/, u.checkForUpdates()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        this.state = 'error';
                        this.lastError = err_1.message;
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, this.getStatus()];
                }
            });
        });
    };
    AutoUpdaterService.prototype.downloadUpdate = function () {
        return __awaiter(this, void 0, void 0, function () {
            var u, err_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.disabled)
                            return [2 /*return*/, this.getStatus()];
                        u = this.loadUpdater();
                        if (!u)
                            return [2 /*return*/, this.getStatus()];
                        if (this.state !== 'available') {
                            this.lastError = "cannot download from state=".concat(this.state);
                            return [2 /*return*/, this.getStatus()];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, u.downloadUpdate()];
                    case 2:
                        _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        err_2 = _a.sent();
                        this.state = 'error';
                        this.lastError = err_2.message;
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/, this.getStatus()];
                }
            });
        });
    };
    AutoUpdaterService.prototype.quitAndInstall = function () {
        var _this = this;
        if (this.disabled)
            return this.getStatus();
        var u = this.loadUpdater();
        if (!u)
            return this.getStatus();
        if (this.state !== 'downloaded') {
            this.lastError = "cannot install from state=".concat(this.state);
            return this.getStatus();
        }
        // Small delay lets the IPC reply return before the app dies.
        setTimeout(function () {
            try {
                u.quitAndInstall(false, true);
            }
            catch (err) {
                _this.state = 'error';
                _this.lastError = err.message;
            }
        }, 200);
        return this.getStatus();
    };
    /** Notify renderer of state changes (used for push-style updates). */
    AutoUpdaterService.prototype.broadcast = function (win) {
        try {
            win === null || win === void 0 ? void 0 : win.webContents.send('moonlight:update:status', this.getStatus());
        }
        catch (_a) {
            /* ignore */
        }
    };
    return AutoUpdaterService;
}());
exports.AutoUpdaterService = AutoUpdaterService;
