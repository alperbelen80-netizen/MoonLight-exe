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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackendManager = void 0;
var child_process_1 = require("child_process");
var fs = require("fs");
var path = require("path");
var http = require("http");
var net = require("net");
var electron_1 = require("electron");
var DEFAULT_OPTIONS = {
    preferredPort: 8001,
    healthPath: '/api/healthz',
    healthTimeoutMs: 1500,
    healthRetryDelayMs: 1000,
    // 60 retries × 1s ≈ 60s boot budget. Nest + TypeORM bootstrap is ~10s
    // on a warm machine, so 60s covers cold starts on laptops too.
    healthMaxRetries: 60,
    logFileName: 'backend.log',
};
var BackendManager = /** @class */ (function () {
    function BackendManager(options) {
        if (options === void 0) { options = {}; }
        var _a;
        this.proc = null;
        this.port = null;
        this.startedAtMs = null;
        this.lastError = null;
        this.logFile = null;
        this.logStream = null;
        this.backendEntry = null;
        this.shuttingDown = false;
        // v2.6-4: optional crash hook. Electron main wires this up to the
        // CrashReporterService so unexpected exits land in crash-history.jsonl
        // and optionally forward to backend /api/crash/report.
        this.onUnexpectedExit = null;
        this.opts = __assign(__assign({}, DEFAULT_OPTIONS), options);
        this.extraEnv = (_a = options.extraEnv) !== null && _a !== void 0 ? _a : {};
    }
    /** v2.6-4: register a crash hook. Called only for non-graceful exits. */
    BackendManager.prototype.setCrashHook = function (hook) {
        this.onUnexpectedExit = hook;
    };
    BackendManager.prototype.getStatus = function () {
        var _a, _b;
        return {
            running: Boolean(this.proc && this.proc.exitCode === null),
            port: this.port,
            pid: (_b = (_a = this.proc) === null || _a === void 0 ? void 0 : _a.pid) !== null && _b !== void 0 ? _b : null,
            backendEntry: this.backendEntry,
            startedAtMs: this.startedAtMs,
            lastError: this.lastError,
            logFile: this.logFile,
        };
    };
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
    BackendManager.prototype.resolveBackendEntry = function () {
        var override = process.env.MOONLIGHT_BACKEND_ENTRY;
        if (override && fs.existsSync(override))
            return override;
        var packagedPath = path.join(process.resourcesPath || '', 'backend-bundle', 'backend.js');
        if (fs.existsSync(packagedPath))
            return packagedPath;
        // Dev fallback: repo root/../dist-bundle/backend.js relative to this file.
        var devPath = path.resolve(__dirname, '..', '..', '..', 'dist-bundle', 'backend.js');
        if (fs.existsSync(devPath))
            return devPath;
        throw new Error("backend bundle not found. Looked at " +
            "MOONLIGHT_BACKEND_ENTRY=".concat(override !== null && override !== void 0 ? override : '(unset)', ", ") +
            "".concat(packagedPath, ", ").concat(devPath));
    };
    /**
     * Bind-test a port: if `preferredPort` is free use it, else walk upwards.
     * Exposed as `protected` so tests can override the walking strategy.
     */
    BackendManager.prototype.pickFreePort = function (preferred_1) {
        return __awaiter(this, arguments, void 0, function (preferred, tries) {
            var _loop_1, i, state_1;
            if (tries === void 0) { tries = 20; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _loop_1 = function (i) {
                            var port, free;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        port = preferred + i;
                                        return [4 /*yield*/, new Promise(function (resolve) {
                                                var s = net.createServer();
                                                s.once('error', function () { return resolve(false); });
                                                s.once('listening', function () {
                                                    s.close(function () { return resolve(true); });
                                                });
                                                s.listen(port, '127.0.0.1');
                                            })];
                                    case 1:
                                        free = _b.sent();
                                        if (free)
                                            return [2 /*return*/, { value: port }];
                                        return [2 /*return*/];
                                }
                            });
                        };
                        i = 0;
                        _a.label = 1;
                    case 1:
                        if (!(i < tries)) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_1(i)];
                    case 2:
                        state_1 = _a.sent();
                        if (typeof state_1 === "object")
                            return [2 /*return*/, state_1.value];
                        _a.label = 3;
                    case 3:
                        i++;
                        return [3 /*break*/, 1];
                    case 4: throw new Error("no free port found in [".concat(preferred, ", ").concat(preferred + tries, ")"));
                }
            });
        });
    };
    BackendManager.prototype.openLogStream = function () {
        try {
            var logsDir = (electron_1.app === null || electron_1.app === void 0 ? void 0 : electron_1.app.getPath) ? electron_1.app.getPath('logs') : path.resolve('.');
            if (!fs.existsSync(logsDir))
                fs.mkdirSync(logsDir, { recursive: true });
            this.logFile = path.join(logsDir, this.opts.logFileName);
            this.logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
            var banner = "\n---- backend started @ ".concat(new Date().toISOString(), " ----\n");
            this.logStream.write(banner);
        }
        catch (err) {
            // logs are best-effort; never block spawn on FS issues.
            this.logFile = null;
            this.logStream = null;
        }
    };
    /** Start the backend. Resolves with the bound port. */
    BackendManager.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, bundleDir, env, err_1;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.proc && this.proc.exitCode === null) {
                            return [2 /*return*/, this.port];
                        }
                        this.shuttingDown = false;
                        this.lastError = null;
                        this.backendEntry = this.resolveBackendEntry();
                        _a = this;
                        return [4 /*yield*/, this.pickFreePort(this.opts.preferredPort)];
                    case 1:
                        _a.port = _b.sent();
                        this.openLogStream();
                        bundleDir = path.dirname(this.backendEntry);
                        env = __assign(__assign(__assign({}, process.env), this.extraEnv), { PORT: String(this.port), MOONLIGHT_PORT: String(this.port), NODE_ENV: process.env.NODE_ENV || 'production', ELECTRON_RUN_AS_NODE: '1', 
                            // Explicit config dir override — wins over CWD-based heuristics.
                            MOONLIGHT_CONFIG_DIR: path.join(bundleDir, 'src') });
                        this.proc = (0, child_process_1.spawn)(process.execPath, [this.backendEntry], {
                            env: env,
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
                        this.proc.on('exit', function (code, signal) {
                            var _a, _b;
                            var msg = "backend exited (code=".concat(code, " signal=").concat(signal, ")");
                            var wasShutdown = _this.shuttingDown;
                            if (!wasShutdown)
                                _this.lastError = msg;
                            try {
                                (_a = _this.logStream) === null || _a === void 0 ? void 0 : _a.write("\n[BackendManager] ".concat(msg, "\n"));
                            }
                            catch (_c) {
                                /* ignore */
                            }
                            (_b = _this.logStream) === null || _b === void 0 ? void 0 : _b.end();
                            _this.logStream = null;
                            var uptime = _this.startedAtMs ? Date.now() - _this.startedAtMs : null;
                            var entry = _this.backendEntry;
                            var logFile = _this.logFile;
                            _this.proc = null;
                            // v2.6-4: surface crash to registered hook (CrashReporterService).
                            if (!wasShutdown && _this.onUnexpectedExit) {
                                try {
                                    _this.onUnexpectedExit({
                                        code: code,
                                        signal: signal !== null && signal !== void 0 ? signal : null,
                                        lastError: msg,
                                        entry: entry,
                                        logFile: logFile,
                                        uptimeMs: uptime,
                                    });
                                }
                                catch (_d) {
                                    /* ignore — crash hooks must never cascade */
                                }
                            }
                        });
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 4, , 6]);
                        return [4 /*yield*/, this.waitForHealth()];
                    case 3:
                        _b.sent();
                        return [3 /*break*/, 6];
                    case 4:
                        err_1 = _b.sent();
                        this.lastError = err_1.message;
                        return [4 /*yield*/, this.stop()];
                    case 5:
                        _b.sent();
                        throw err_1;
                    case 6: return [2 /*return*/, this.port];
                }
            });
        });
    };
    BackendManager.prototype.waitForHealth = function () {
        return __awaiter(this, void 0, void 0, function () {
            var i, ok;
            var _this = this;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        i = 0;
                        _c.label = 1;
                    case 1:
                        if (!(i < this.opts.healthMaxRetries)) return [3 /*break*/, 5];
                        // Bail out fast if the process already died.
                        if (!this.proc || this.proc.exitCode !== null) {
                            throw new Error("backend crashed during startup (exit=".concat((_b = (_a = this.proc) === null || _a === void 0 ? void 0 : _a.exitCode) !== null && _b !== void 0 ? _b : 'n/a', ")"));
                        }
                        return [4 /*yield*/, this.httpGetOk("http://127.0.0.1:".concat(this.port).concat(this.opts.healthPath))];
                    case 2:
                        ok = _c.sent();
                        if (ok)
                            return [2 /*return*/];
                        return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, _this.opts.healthRetryDelayMs); })];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4:
                        i++;
                        return [3 /*break*/, 1];
                    case 5: throw new Error("backend did not become healthy within " +
                        "".concat(this.opts.healthMaxRetries * this.opts.healthRetryDelayMs, "ms"));
                }
            });
        });
    };
    BackendManager.prototype.httpGetOk = function (url) {
        var _this = this;
        return new Promise(function (resolve) {
            var req = http.get(url, { timeout: _this.opts.healthTimeoutMs }, function (res) {
                var ok = typeof res.statusCode === 'number' && res.statusCode < 500;
                // Drain + close so we don't leak sockets.
                res.resume();
                resolve(ok);
            });
            req.on('error', function () { return resolve(false); });
            req.on('timeout', function () {
                req.destroy();
                resolve(false);
            });
        });
    };
    /** Stop the backend gracefully. SIGTERM → SIGKILL fallback after 5s. */
    BackendManager.prototype.stop = function () {
        return __awaiter(this, arguments, void 0, function (graceMs) {
            var p, exited;
            if (graceMs === void 0) { graceMs = 5000; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.shuttingDown = true;
                        p = this.proc;
                        if (!p || p.exitCode !== null) {
                            this.proc = null;
                            return [2 /*return*/];
                        }
                        try {
                            // Windows lacks POSIX signals; child_process .kill() uses taskkill
                            // internally via TerminateProcess for most cases.
                            p.kill('SIGTERM');
                        }
                        catch (_b) {
                            /* ignore */
                        }
                        return [4 /*yield*/, new Promise(function (resolve) {
                                var t = setTimeout(function () { return resolve(false); }, graceMs);
                                p.once('exit', function () {
                                    clearTimeout(t);
                                    resolve(true);
                                });
                            })];
                    case 1:
                        exited = _a.sent();
                        if (!exited) {
                            try {
                                p.kill('SIGKILL');
                            }
                            catch (_c) {
                                /* ignore */
                            }
                        }
                        this.proc = null;
                        return [2 /*return*/];
                }
            });
        });
    };
    return BackendManager;
}());
exports.BackendManager = BackendManager;
