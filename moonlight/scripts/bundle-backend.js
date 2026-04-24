/**
 * MoonLight v2.6-1 — Backend single-file bundler.
 *
 * Produces a single `dist-bundle/backend.js` file that Electron's main
 * process can spawn as a Node process (via `process.execPath` with
 * `ELECTRON_RUN_AS_NODE=1`, or any standalone `node`).
 *
 * Native / non-bundlable modules are marked external; they're shipped
 * alongside via a minimal `node_modules` resource set in electron-builder's
 * `extraResources`.
 *
 * Usage:
 *   node scripts/bundle-backend.js           # dev
 *   node scripts/bundle-backend.js --minify  # release
 */

const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.resolve(__dirname, '..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'backend');
const OUT_DIR = path.join(REPO_ROOT, 'dist-bundle');
const OUT_FILE = path.join(OUT_DIR, 'backend.js');

// Resolve esbuild from the monorepo root deterministically (Windows/Linux safe).
// Falls back to standard `require('esbuild')` in case it was hoisted elsewhere.
function loadEsbuild() {
  const candidates = [
    path.join(REPO_ROOT, 'node_modules', 'esbuild'),
    path.join(REPO_ROOT, 'node_modules', 'esbuild', 'lib', 'main.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      try {
        return require(candidate);
      } catch (_) {
        // fall through
      }
    }
  }
  try {
    return require('esbuild');
  } catch (err) {
    console.error(
      '[bundle-backend] FATAL: esbuild is not installed.\n' +
        '  Fix: run `yarn install` at the repo root so esbuild is present\n' +
        '       under node_modules/esbuild (it is listed as a devDependency).\n' +
        `  Original error: ${err.message}`,
    );
    process.exit(1);
  }
}

const esbuild = loadEsbuild();

// Native + notoriously bundle-hostile deps that must remain external.
// These will be resolved at runtime from `resources/node_modules`.
const EXTERNAL = [
  // Native binaries
  'better-sqlite3',
  'sqlite3',
  'bufferutil',
  'utf-8-validate',
  // TypeORM dialect drivers we don't use (avoid "Cannot find module" at load)
  'pg',
  'pg-native',
  'mysql',
  'mysql2',
  'oracledb',
  'mssql',
  'sql.js',
  'mongodb',
  'redis',
  'ioredis',
  'typeorm-aurora-data-api-driver',
  'hdb-pool',
  '@sap/hana-client',
  'react-native-sqlite-storage',
  // NestJS optional peers we don't use
  '@nestjs/microservices',
  '@nestjs/websockets',
  '@nestjs/platform-socket.io',
  '@nestjs/platform-ws',
  'kafkajs',
  'mqtt',
  'nats',
  'amqplib',
  'amqp-connection-manager',
  'cache-manager',
  'class-transformer/storage',
  // Optional / dev
  'playwright',
  'playwright-core',
  'class-validator',
  'class-transformer',
  // Parquet + bson natives
  'snappy',
  'bson',
  // Large deps with nested native / .node imports — keep external.
  'ccxt',
  'node-fetch',
  'ws',
  'ethers',
  'protobufjs',
  'protobufjs/minimal',
  'protobufjs/minimal.js',
  '@grpc/grpc-js',
  '@grpc/proto-loader',
  'grpc',
  'bull',
  'ioredis',
  'parquetjs',
  'parquetjs-lite',
  'thrift',
  'lz4',
  'lzo',
  'brotli',
  'brotli-wasm',
];

const isMinify = process.argv.includes('--minify');

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // Sanity check: the TS build output must exist before we can bundle.
  const entryFile = path.join(
    BACKEND_ROOT,
    'dist',
    'backend',
    'src',
    'main.js',
  );
  if (!fs.existsSync(entryFile)) {
    console.error(
      '[bundle-backend] FATAL: backend entry missing.\n' +
        `  Expected: ${entryFile}\n` +
        '  Fix: run `yarn build:backend` (or `yarn --cwd backend build`) first.',
    );
    process.exit(1);
  }

  const start = Date.now();
  console.log(
    `[bundle-backend] entry=${entryFile}  outfile=${OUT_FILE}  minify=${isMinify}`,
  );

  const result = await esbuild.build({
    entryPoints: [entryFile],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: OUT_FILE,
    external: EXTERNAL,
    sourcemap: isMinify ? false : 'inline',
    minify: isMinify,
    // Explicit tree-shaking (esbuild tree-shakes CJS too, but we make it visible).
    treeShaking: true,
    // Emit a metafile so we can surface bundle composition in CI logs.
    metafile: true,
    logLevel: 'info',
    // NestJS emits decorator metadata; keep class names intact for DI.
    keepNames: true,
    // Preserve `__dirname`-style resource lookups.
    define: {
      'process.env.NODE_ENV': JSON.stringify(
        process.env.NODE_ENV || 'production',
      ),
    },
  });

  // ---- Integrity checks (fail-fast if silent corruption happened) --------
  if (!fs.existsSync(OUT_FILE)) {
    console.error('[bundle-backend] FATAL: outfile not written');
    process.exit(1);
  }
  const size = fs.statSync(OUT_FILE).size;
  const kb = (size / 1024).toFixed(1);
  const mb = (size / (1024 * 1024)).toFixed(2);
  const elapsed = Date.now() - start;
  if (size < 100 * 1024) {
    console.error(
      `[bundle-backend] FATAL: bundle is suspiciously small (${kb} KB < 100 KB).\n` +
        '  Likely causes: silent esbuild failure, missing entry, or tree-shaking error.',
    );
    process.exit(1);
  }

  // Node --check syntax validation on the final artifact.
  try {
    const { execSync } = require('child_process');
    execSync(`node --check "${OUT_FILE}"`, { stdio: 'pipe' });
    console.log('[bundle-backend] syntax check: OK (node --check)');
  } catch (e) {
    console.error(
      '[bundle-backend] FATAL: bundle failed node --check syntax validation.\n' +
        (e.stderr ? `  stderr: ${e.stderr.toString()}` : ''),
    );
    process.exit(1);
  }

  // Persist the metafile next to the bundle for ad-hoc analysis.
  try {
    const metafilePath = path.join(OUT_DIR, 'backend.meta.json');
    fs.writeFileSync(metafilePath, JSON.stringify(result.metafile, null, 2));
    // Top-5 largest inputs (quick "why is bundle big?" signal)
    const inputs = Object.entries(result.metafile.inputs)
      .map(([k, v]) => ({ path: k, bytes: v.bytes }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5);
    console.log('[bundle-backend] top-5 largest inputs:');
    for (const i of inputs) {
      console.log(
        `  - ${i.path}  ${(i.bytes / 1024).toFixed(1)} KB`,
      );
    }
    console.log(`[bundle-backend] metafile written: ${metafilePath}`);
  } catch (e) {
    console.warn('[bundle-backend] WARN: could not write metafile:', e.message);
  }

  console.log(
    `[bundle-backend] SUCCESS ✅  wrote ${OUT_FILE}  ${mb} MB (${kb} KB)  in ${elapsed}ms`,
  );

  // Also write a sibling `package.json` so the bundle can be hoisted into
  // resources/ verbatim and stay a valid Node entry point.
  const backendPkgJson = path.join(BACKEND_ROOT, 'package.json');
  const backendVersion = fs.existsSync(backendPkgJson)
    ? require(backendPkgJson).version
    : '0.0.0';
  fs.writeFileSync(
    path.join(OUT_DIR, 'package.json'),
    JSON.stringify(
      {
        name: 'moonlight-backend-bundle',
        version: backendVersion,
        private: true,
        main: 'backend.js',
      },
      null,
      2,
    ),
  );

  if (result.warnings.length) {
    console.warn(`[bundle-backend] ${result.warnings.length} warnings`);
  }
}

main().catch((err) => {
  console.error('[bundle-backend] FAILED:', err);
  process.exit(1);
});
