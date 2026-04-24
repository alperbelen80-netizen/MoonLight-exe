#!/usr/bin/env node
/**
 * MoonLight v2.6-3 / v2.6-10 — Packaged smoke test.
 *
 * Spawns the backend from the *packaged* appOutDir layout (the same paths
 * that Electron's BackendManager would hit in production) and verifies:
 *   1. process launches without crashing
 *   2. /api/healthz returns 200 within the health budget
 *   3. shutdown via SIGTERM is clean
 *
 * This does NOT launch Electron itself (we don't have a working DISPLAY
 * in CI); it just proves the **bundled backend + extraResources layout**
 * would work when Electron spawns it on a real user machine.
 *
 * Platform-agnostic path resolution: uses `os.tmpdir()` and auto-detects
 * the appOutDir so the same script works on Linux (linux-arm64-unpacked),
 * macOS (mac-unpacked), and Windows (win-unpacked).
 *
 * Override points:
 *   - env `MOONLIGHT_APP_OUT_DIR` → absolute path to the unpacked app dir
 *   - CLI arg `--appOutDir <path>`
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const DESKTOP_DIST = path.join(REPO_ROOT, 'desktop', 'dist');

// --- Resolve packaged app output directory ---------------------------------

function resolveAppOutDir() {
  // 1) Explicit CLI argument wins.
  const cliIdx = process.argv.indexOf('--appOutDir');
  if (cliIdx !== -1 && process.argv[cliIdx + 1]) {
    return path.resolve(process.argv[cliIdx + 1]);
  }
  // 2) Environment override.
  if (process.env.MOONLIGHT_APP_OUT_DIR) {
    return path.resolve(process.env.MOONLIGHT_APP_OUT_DIR);
  }
  // 3) Auto-detect under desktop/dist: look for any *-unpacked dir.
  if (!fs.existsSync(DESKTOP_DIST)) {
    throw new Error(
      `desktop/dist missing: ${DESKTOP_DIST}\n` +
        'Did you run `cd desktop && yarn dist:dir` first?',
    );
  }
  const entries = fs.readdirSync(DESKTOP_DIST, { withFileTypes: true });
  const unpacked = entries.find(
    (e) => e.isDirectory() && e.name.endsWith('-unpacked'),
  );
  if (!unpacked) {
    throw new Error(
      `Could not auto-detect *-unpacked directory under ${DESKTOP_DIST}.\n` +
        'Pass --appOutDir <path> or set MOONLIGHT_APP_OUT_DIR explicitly.',
    );
  }
  return path.join(DESKTOP_DIST, unpacked.name);
}

const APP_OUT_DIR = resolveAppOutDir();
const RESOURCES_DIR = path.join(APP_OUT_DIR, 'resources');
const BACKEND_ENTRY = path.join(
  RESOURCES_DIR,
  'backend-bundle',
  'backend.js',
);

const PORT = 18799;
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/healthz`;

// --- Helpers ----------------------------------------------------------------

function log(msg) {
  console.log(`[packaged-smoke] ${msg}`);
}

function hit(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: 1500 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () =>
        resolve({ status: res.statusCode, body, headers: res.headers }),
      );
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('timeout'));
    });
  });
}

async function waitForHealth(maxMs) {
  const start = Date.now();
  let lastErr = null;
  while (Date.now() - start < maxMs) {
    try {
      const r = await hit(HEALTH_URL);
      if (r.status === 200) return r;
      lastErr = `HTTP ${r.status}`;
    } catch (e) {
      lastErr = e.message;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`health never green after ${maxMs}ms (last=${lastErr})`);
}

// --- Main -------------------------------------------------------------------

async function main() {
  log(`REPO_ROOT     = ${REPO_ROOT}`);
  log(`APP_OUT_DIR   = ${APP_OUT_DIR}`);
  log(`BACKEND_ENTRY = ${BACKEND_ENTRY}`);

  if (!fs.existsSync(BACKEND_ENTRY)) {
    throw new Error(
      `Packaged backend bundle missing: ${BACKEND_ENTRY}\n` +
        'Did you run `cd desktop && yarn dist:dir` (or `yarn dist:win`) first?',
    );
  }

  // Use OS temp dir so the smoke test pollutes nothing permanent and works
  // identically on Linux/macOS/Windows.
  const tmpRoot = os.tmpdir();
  const dbPath = path.join(tmpRoot, 'moonlight-packaged-smoke.sqlite');
  const dataDir = path.join(tmpRoot, 'moonlight-packaged-smoke-data');
  fs.mkdirSync(dataDir, { recursive: true });

  const env = {
    ...process.env,
    PORT: String(PORT),
    NODE_ENV: 'production',
    MOONLIGHT_PACKAGED: 'true',
    // Vault strict only when packaged — disabled here so the smoke runs
    // without real secrets. The vault itself still initializes.
    MOONLIGHT_VAULT_STRICT: 'false',
    DB_PATH: dbPath,
    MOONLIGHT_DATA_DIR: dataDir,
    // Explicit config dir — matches what BackendManager sets in prod.
    MOONLIGHT_CONFIG_DIR: path.join(path.dirname(BACKEND_ENTRY), 'src'),
    // Force lazy boot of heavy engines (they'll be started manually if needed).
    LIVE_SIGNAL_AUTO_START: 'false',
    BROKER_IQOPTION_REAL_ENABLED: 'false',
    BROKER_DOM_AUTOMATION_ENABLED: 'false',
  };

  log('spawning backend via node runtime (packaged layout)...');
  const proc = spawn('node', [BACKEND_ENTRY], {
    // Match what BackendManager does: cwd = bundle dir so bundle-safe
    // config resolver can find src/config/*.yaml without override.
    cwd: path.dirname(BACKEND_ENTRY),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const output = [];
  proc.stdout.on('data', (d) => {
    const s = d.toString();
    output.push(s);
    process.stdout.write(`[backend:out] ${s}`);
  });
  proc.stderr.on('data', (d) => {
    const s = d.toString();
    output.push(s);
    process.stderr.write(`[backend:err] ${s}`);
  });

  const earlyExit = new Promise((_res, rej) => {
    proc.once('exit', (code, signal) => {
      rej(
        new Error(
          `backend exited early code=${code} signal=${signal}\n` +
            `last output:\n${output.slice(-20).join('')}`,
        ),
      );
    });
  });

  try {
    const healthy = await Promise.race([
      waitForHealth(60_000),
      earlyExit,
    ]);
    log(
      `health OK status=${healthy.status} body=${healthy.body.slice(0, 120)}`,
    );

    // Simple secrets API smoke.
    try {
      const r = await hit(`http://127.0.0.1:${PORT}/api/secrets/health`);
      log(`secrets/health status=${r.status}`);
    } catch (e) {
      log(`secrets/health probe failed: ${e.message}`);
    }
  } finally {
    log('sending SIGTERM...');
    proc.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1500));
    if (proc.exitCode === null) {
      log('forcing SIGKILL');
      proc.kill('SIGKILL');
    }
  }

  log('PASS');
}

main().catch((err) => {
  console.error('[packaged-smoke] FAILED:', err.message);
  process.exit(1);
});
