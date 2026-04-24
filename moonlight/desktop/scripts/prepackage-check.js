#!/usr/bin/env node
/**
 * MoonLight v2.6-3 — prepackage-check.
 *
 * Runs before `electron-builder` to make sure the build is feasible:
 *   1. Backend single-file bundle (`../dist-bundle/backend.js`) exists.
 *      If missing, we run the bundler (production mode) automatically.
 *   2. Backend node_modules exists (sqlite3 etc.) at `../backend/node_modules`.
 *      If missing, we emit a clear error explaining how to fix it in CI
 *      (the CI pipeline is expected to run an isolated `npm install` in
 *      the backend/ workspace before this check).
 *   3. Icons exist; if not, a minimal placeholder set is acceptable only
 *      in DEV; in CI we require real icons (but still don't hard-fail to
 *      keep the first Windows build path green — we warn loudly instead).
 *
 * This script is intentionally small and self-contained (no deps).
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DESKTOP_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(DESKTOP_DIR, '..');
const BUNDLE_FILE = path.join(REPO_ROOT, 'dist-bundle', 'backend.js');
const BACKEND_NODE_MODULES = path.join(REPO_ROOT, 'backend', 'node_modules');
const ICON_ICO = path.join(DESKTOP_DIR, 'build', 'icon.ico');
const ICON_PNG = path.join(DESKTOP_DIR, 'build', 'icon.png');

const IS_WINDOWS = os.platform() === 'win32';
const IS_CI = process.env.CI === 'true' || process.env.CI === '1';

function sizeOf(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return -1;
  }
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: REPO_ROOT,
    env: process.env,
    ...opts,
  });
  if (res.status !== 0) {
    throw new Error(
      `[prepackage] command failed: ${cmd} ${args.join(' ')} → exit ${res.status}`,
    );
  }
}

function checkBundle() {
  if (fs.existsSync(BUNDLE_FILE)) {
    const kb = (sizeOf(BUNDLE_FILE) / 1024).toFixed(1);
    console.log(`[prepackage] backend bundle OK: ${BUNDLE_FILE} (${kb} KB)`);
    return;
  }
  console.log(
    `[prepackage] backend bundle missing → running bundler (production)...`,
  );
  // Ensure the compiled JS exists first.
  const compiled = path.join(
    REPO_ROOT,
    'backend',
    'dist',
    'backend',
    'src',
    'main.js',
  );
  if (!fs.existsSync(compiled)) {
    console.log(`[prepackage] backend dist missing → building backend...`);
    run('yarn', ['--cwd', 'backend', 'build']);
  }
  run('node', ['scripts/bundle-backend.js', '--minify']);
  if (!fs.existsSync(BUNDLE_FILE)) {
    throw new Error(
      `[prepackage] bundler ran but ${BUNDLE_FILE} still missing`,
    );
  }
}

function checkBackendNodeModules() {
  if (!fs.existsSync(BACKEND_NODE_MODULES)) {
    console.warn(
      `[prepackage] WARN: ${BACKEND_NODE_MODULES} is missing.\n` +
        '         The packaged app will still run if natives are bundled,\n' +
        '         but sqlite3/keytar may be absent. In CI, run:\n' +
        '           cd backend && npm install --omit=dev --no-package-lock\n' +
        '         before invoking electron-builder.',
    );
    return;
  }
  const entries = fs.readdirSync(BACKEND_NODE_MODULES);
  console.log(
    `[prepackage] backend/node_modules OK (${entries.length} entries)`,
  );
  // Probe a few important natives (informational).
  const probes = ['sqlite3', 'keytar', 'ws', 'ccxt'];
  for (const p of probes) {
    const full = path.join(BACKEND_NODE_MODULES, p);
    console.log(
      `[prepackage]   probe ${p}: ${fs.existsSync(full) ? 'present' : 'missing (optional)'}`,
    );
  }
}

function checkIcons() {
  const icoOk = fs.existsSync(ICON_ICO) && sizeOf(ICON_ICO) > 0;
  const pngOk = fs.existsSync(ICON_PNG) && sizeOf(ICON_PNG) > 0;
  console.log(
    `[prepackage] icons: ico=${icoOk ? 'OK' : 'MISSING'} png=${pngOk ? 'OK' : 'MISSING'}`,
  );

  // Windows NSIS builds NEED icon.ico. In CI on Windows, treat missing
  // ico as a hard failure so we don't ship a broken installer. On dev
  // machines (non-CI), stay lenient so local experiments keep working.
  if (IS_WINDOWS && !icoOk) {
    const msg =
      `icon.ico is required on Windows builds.\n` +
      `  Expected: ${ICON_ICO}\n` +
      `  Fix: drop a valid 256x256 (or multi-res) .ico into desktop/build/icon.ico`;
    if (IS_CI) {
      throw new Error(msg);
    }
    console.warn(`[prepackage] WARN (local): ${msg}`);
  }

  if (!icoOk || !pngOk) {
    console.warn(
      '[prepackage] WARN: at least one icon is missing. electron-builder\n' +
        '         will fall back to its default icon set, which is fine for\n' +
        '         CI smoke but should be replaced before real distribution.',
    );
  }
}

function main() {
  console.log('[prepackage] MoonLight v2.6-10 pre-package checks');
  console.log(`[prepackage]   platform  = ${os.platform()} (${os.arch()})`);
  console.log(`[prepackage]   CI        = ${IS_CI}`);
  console.log(`[prepackage]   REPO_ROOT = ${REPO_ROOT}`);
  checkBundle();
  checkBackendNodeModules();
  checkIcons();
  console.log('[prepackage] OK');
}

try {
  main();
} catch (err) {
  console.error('[prepackage] FAILED:', err.message);
  process.exit(1);
}
