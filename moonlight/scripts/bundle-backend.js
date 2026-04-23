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
const esbuild = require('/app/moonlight/node_modules/esbuild');

const BACKEND_ROOT = path.resolve(__dirname, '..', 'backend');
const OUT_DIR = path.resolve(__dirname, '..', 'dist-bundle');
const OUT_FILE = path.join(OUT_DIR, 'backend.js');

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

  const start = Date.now();
  const result = await esbuild.build({
    entryPoints: [path.join(BACKEND_ROOT, 'dist', 'backend', 'src', 'main.js')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: OUT_FILE,
    external: EXTERNAL,
    sourcemap: isMinify ? false : 'inline',
    minify: isMinify,
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

  // Copy a minimal bootstrap wrapper so Electron can exec the bundle even
  // when started via `ELECTRON_RUN_AS_NODE=1` (no CLI args are forwarded).
  const size = fs.statSync(OUT_FILE).size;
  const kb = (size / 1024).toFixed(1);
  const elapsed = Date.now() - start;
  console.log(
    `[bundle-backend] wrote ${OUT_FILE} (${kb} KB) in ${elapsed}ms`,
  );

  // Also write a sibling `package.json` so the bundle can be hoisted into
  // resources/ verbatim and stay a valid Node entry point.
  fs.writeFileSync(
    path.join(OUT_DIR, 'package.json'),
    JSON.stringify(
      {
        name: 'moonlight-backend-bundle',
        version: require('../backend/package.json').version,
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
