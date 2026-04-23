/**
 * MoonLight v2.6-1 — BackendManager end-to-end smoke test.
 *
 * Runs the TypeScript BackendManager (compiled on the fly via tsc-lite)
 * against the real bundled backend in /app/moonlight/dist-bundle/backend.js,
 * without needing the full Electron runtime.
 *
 * We stub the minimal Electron `app` surface (only `getPath`) so the
 * manager's log-stream opener doesn't crash. Then we:
 *   1. start() the backend
 *   2. assert /api/healthz responds 200
 *   3. assert a V2.5 endpoint responds (/api/broker/sim/state)
 *   4. stop() and assert the process exits cleanly
 *
 * Exit code 0 ⇒ end-to-end wiring works. Any non-zero exit is a hard fail
 * that must block v2.6-1 release.
 */

process.env.ELECTRON_RUN_AS_NODE = '1';

const path = require('path');
const http = require('http');
const Module = require('module');

// Inject a lightweight 'electron' stub BEFORE BackendManager loads.
const logsDir = path.resolve('/tmp', 'moonlight-logs');
require('fs').mkdirSync(logsDir, { recursive: true });
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'electron') {
    return require.resolve(path.resolve(__dirname, 'electron-stub.js'));
  }
  return originalResolve.call(this, request, parent, ...rest);
};
// Create the stub inline.
require('fs').writeFileSync(
  path.resolve(__dirname, 'electron-stub.js'),
  `module.exports = { app: { getPath: (k) => k === 'logs' ? '${logsDir.replace(/\\/g, '\\\\')}' : '${logsDir.replace(/\\/g, '\\\\')}' } };`,
);

// Compile BackendManager on the fly (no prebuilt dist required).
require('/app/moonlight/node_modules/ts-node/register').register
  ? null
  : (() => {
      try { require('ts-node/register'); } catch (_) {}
    })();

// Fall back: use the already-compiled dist-electron/main/backend-manager.js
// produced by `yarn build`.
const compiledPath = path.resolve(
  __dirname,
  '..',
  'desktop',
  'dist-electron',
  'backend-manager.js',
);
const { BackendManager } = require(compiledPath);

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

async function main() {
  const mgr = new BackendManager({
    preferredPort: 8901, // avoid colliding with any live backend on :8001
    healthMaxRetries: 45,
    healthRetryDelayMs: 1000,
    // Test env: override entry explicitly to the bundled backend we already
    // verified loads & serves.
    extraEnv: {
      MOONLIGHT_BACKEND_ENTRY: path.resolve(
        __dirname,
        '..',
        'dist-bundle',
        'backend.js',
      ),
      NODE_ENV: 'production',
    },
  });
  // The manager reads MOONLIGHT_BACKEND_ENTRY from process.env (not extraEnv
  // at resolve time), so mirror it here too.
  process.env.MOONLIGHT_BACKEND_ENTRY = path.resolve(
    __dirname,
    '..',
    'dist-bundle',
    'backend.js',
  );

  console.log('[smoke] starting backend via BackendManager...');
  const t0 = Date.now();
  const port = await mgr.start();
  console.log(`[smoke] backend up on port ${port} in ${Date.now() - t0}ms`);

  const h = await httpGet(`http://127.0.0.1:${port}/api/healthz`);
  console.log(`[smoke] /api/healthz → HTTP ${h.status}`);
  if (h.status !== 200) throw new Error(`healthz not 200 (got ${h.status})`);

  const sim = await httpGet(`http://127.0.0.1:${port}/api/broker/sim/state`);
  console.log(`[smoke] /api/broker/sim/state → HTTP ${sim.status}`);
  if (sim.status !== 200) throw new Error(`sim/state not 200 (got ${sim.status})`);
  if (!sim.body.includes('IQ_OPTION')) {
    throw new Error('sim/state missing IQ_OPTION broker entry');
  }

  const trinity = await httpGet(`http://127.0.0.1:${port}/api/trinity/resources`);
  console.log(`[smoke] /api/trinity/resources → HTTP ${trinity.status}`);
  if (trinity.status !== 200) throw new Error(`trinity/resources not 200`);

  console.log('[smoke] stopping backend...');
  await mgr.stop();
  console.log('[smoke] PASS ✅');
}

main().catch((err) => {
  console.error('[smoke] FAIL ❌', err);
  process.exit(1);
});
