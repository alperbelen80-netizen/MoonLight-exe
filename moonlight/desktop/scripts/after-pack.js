/**
 * MoonLight v2.6-3 — electron-builder afterPack hook.
 *
 * Runs once per target after files are copied into the per-platform
 * appOutDir (before the installer is packaged). We use this to:
 *   1. Verify the bundled backend payload (backend.js + minimum node_modules)
 *      is actually present at the expected location. If it's missing we
 *      **fail the build early** instead of shipping a broken installer.
 *   2. Emit a small `backend-bundle/version.json` manifest so the packaged
 *      app can surface "what ships inside me" in Settings → About.
 *   3. Print a one-line size summary for CI logs.
 *
 * This hook is intentionally defensive: it never *modifies* the payload,
 * it only validates and annotates.
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
  'backend-bundle/backend.js',
  'backend-bundle/package.json',
];

function dirSizeBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      try {
        if (e.isDirectory()) stack.push(p);
        else if (e.isFile()) total += fs.statSync(p).size;
      } catch {
        /* ignore */
      }
    }
  }
  return total;
}

function fmtMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName, arch, packager } = context;
  const isWin = electronPlatformName === 'win32';
  const isMac = electronPlatformName === 'darwin';
  const resourcesDir = path.join(
    appOutDir,
    isMac
      ? `${packager.appInfo.productFilename}.app/Contents/Resources`
      : 'resources',
  );

  console.log(
    `[after-pack] host=${process.platform} target=${electronPlatformName} arch=${arch} resources=${resourcesDir}`,
  );

  // On Windows we intentionally DO NOT call chmod / POSIX-only APIs below —
  // all file operations below use cross-platform `fs` + `path.join`.
  if (isWin) {
    console.log('[after-pack] Windows target detected — skipping POSIX-only steps.');
  }

  // 1) Validate required files exist.
  const missing = [];
  for (const rel of REQUIRED_FILES) {
    const abs = path.join(resourcesDir, rel);
    if (!fs.existsSync(abs)) missing.push(rel);
  }
  if (missing.length) {
    throw new Error(
      '[after-pack] FAILED: missing required payload files in packaged app:\n  - ' +
        missing.join('\n  - ') +
        '\n\nAre you running `yarn bundle:backend` before `electron-builder`?',
    );
  }

  // 2) Emit a version manifest.
  const manifest = {
    productName: packager.appInfo.productName,
    version: packager.appInfo.version,
    builtAt: new Date().toISOString(),
    platform: electronPlatformName,
    arch,
    backendEntry: 'backend-bundle/backend.js',
  };
  const manifestPath = path.join(resourcesDir, 'backend-bundle', 'version.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[after-pack] wrote ${manifestPath}`);

  // 3) Size summary.
  const bundleSize = dirSizeBytes(path.join(resourcesDir, 'backend-bundle'));
  const resourcesSize = dirSizeBytes(resourcesDir);
  console.log(
    `[after-pack] sizes → backend-bundle=${fmtMb(bundleSize)} | resources=${fmtMb(resourcesSize)}`,
  );

  // 4) Native module presence report (informational only — does NOT fail
  // the build, because native rebuild is best-effort in dev/wine runs).
  const nativeProbes = [
    'backend-bundle/node_modules/sqlite3',
    'backend-bundle/node_modules/keytar',
  ];
  for (const probe of nativeProbes) {
    const full = path.join(resourcesDir, probe);
    const present = fs.existsSync(full);
    console.log(
      `[after-pack] native probe: ${probe} → ${present ? 'PRESENT' : 'MISSING (runtime will use fallback)'}`,
    );
  }

  console.log('[after-pack] OK');
};
