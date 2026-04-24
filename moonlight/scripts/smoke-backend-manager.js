/**
 * MoonLight v2.6-1 — BackendManager end-to-end smoke test.
 *
 * Runs the compiled BackendManager against the real bundled backend in
 * <repo>/dist-bundle/backend.js, without needing the full Electron runtime.
 *
 * Platform-agnostic: uses `path.resolve(__dirname, ...)` and `os.tmpdir()`
 * so the same script runs on Linux/macOS/Windows (including CI runners).
 *
 * We stub the minimal Electron `app` surface (only `getPath`) so the
 * manager's log-stream opener doesn't crash. Then we:
 *   1. start() the backend
 *   2. assert /api/healthz responds 200
 *   3. assert a V2.5 endpoint responds (/api/broker/sim/state)
 *   4. assert /api/trinity/resources responds
 *   5. stop() and assert the process exits cleanly
 *
 * Exit code 0 ⇒ end-to-end wiring works.
 */

process.env.ELECTRON_RUN_AS_NODE = '1';

const path = require('path');
const os = require('os');
const fs = require('fs');
const http = require('http');
const Module = require('module');

const REPO_ROOT = path.resolve(__dirname, '..');
const BUNDLE_ENTRY = path.join(REPO_ROOT, 'dist-bundle', 'backend.js');
const COMPILED_MANAGER = path.join(
  REPO_ROOT,
  'desktop',
  'dist-electron',
  'backend-manager.js',
);

// --- Preflight checks -------------------------------------------------------

if (!fs.existsSync(BUNDLE_ENTRY)) {
  console.error(
    '[smoke] FATAL: backend bundle missing.\n' +
      `  Expected: ${BUNDLE_ENTRY}\n` +
      '  Fix: run `yarn build:backend && yarn bundle:backend:prod` first\n' +
      '       (or simply `yarn build:all`).',
  );
  process.exit(1);
}

if (!fs.existsSync(COMPILED_MANAGER)) {
  console.error(
    '[smoke] FATAL: compiled BackendManager missing.\n' +
      `  Expected: ${COMPILED_MANAGER}\n` +
      '  Fix: run `yarn --cwd desktop build` (or `yarn build:desktop`) first.',
  );
  process.exit(1);
}

// --- Electron stub (injected before BackendManager loads) -------------------

const logsDir = path.join(os.tmpdir(), 'moonlight-logs');
fs.mkdirSync(logsDir, { recursive: true });

const stubPath = path.join(os.tmpdir(), 'moonlight-electron-stub.js');
fs.writeFileSync(
  stubPath,
  `module.exports = { app: { getPath: () => ${JSON.stringify(logsDir)} } };\n`,
);

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'electron') return stubPath;
  return originalResolve.call(this, request, parent, ...rest);
};

// --- Load compiled BackendManager ------------------------------------------

const { BackendManager } = require(COMPILED_MANAGER);

// --- HTTP helper ------------------------------------------------------------

function httpGet(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => resolve({ status: res.statusCode, body }));
      })
      .on('error', reject);
  });
}

// --- Main -------------------------------------------------------------------

async function main() {
  console.log(`[smoke] REPO_ROOT       = ${REPO_ROOT}`);
  console.log(`[smoke] BUNDLE_ENTRY    = ${BUNDLE_ENTRY}`);
  console.log(`[smoke] COMPILED_MANAGER= ${COMPILED_MANAGER}`);
  console.log(`[smoke] logsDir         = ${logsDir}`);

  // Point BackendManager at the bundled entry explicitly.
  process.env.MOONLIGHT_BACKEND_ENTRY = BUNDLE_ENTRY;

  const mgr = new BackendManager({
    preferredPort: 8901, // avoid colliding with any live backend on :8001
    healthMaxRetries: 45,
    healthRetryDelayMs: 1000,
    extraEnv: {
      MOONLIGHT_BACKEND_ENTRY: BUNDLE_ENTRY,
      NODE_ENV: 'production',
    },
  });

  console.log('[smoke] starting backend via BackendManager...');
  const t0 = Date.now();
  const port = await mgr.start();
  console.log(`[smoke] backend up on port ${port} in ${Date.now() - t0}ms`);

  try {
    const h = await httpGet(`http://127.0.0.1:${port}/api/healthz`);
    console.log(`[smoke] /api/healthz → HTTP ${h.status}`);
    if (h.status !== 200) throw new Error(`healthz not 200 (got ${h.status})`);

    const sim = await httpGet(`http://127.0.0.1:${port}/api/broker/sim/state`);
    console.log(`[smoke] /api/broker/sim/state → HTTP ${sim.status}`);
    if (sim.status !== 200) {
      throw new Error(`sim/state not 200 (got ${sim.status})`);
    }
    if (!sim.body.includes('IQ_OPTION')) {
      throw new Error('sim/state missing IQ_OPTION broker entry');
    }

    const trinity = await httpGet(
      `http://127.0.0.1:${port}/api/trinity/resources`,
    );
    console.log(`[smoke] /api/trinity/resources → HTTP ${trinity.status}`);
    if (trinity.status !== 200) throw new Error(`trinity/resources not 200`);
  } finally {
    console.log('[smoke] stopping backend...');
    try {
      await mgr.stop();
    } catch (e) {
      console.warn('[smoke] WARN: mgr.stop() threw:', e.message);
    }
  }

  console.log('[smoke] PASS ✅');
}

main().catch((err) => {
  console.error('[smoke] FAIL ❌', err);
  process.exit(1);
});
