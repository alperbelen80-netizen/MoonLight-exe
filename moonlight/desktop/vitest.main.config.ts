import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Dedicated vitest config for the Electron *main* process tests.
 *
 * The renderer has its own config rooted at ./renderer; this one covers
 * the spawn/health/shutdown contract of BackendManager with an `electron`
 * mock so we don't need a real Electron runtime to validate v2.6-1.
 */
export default defineConfig({
  test: {
    include: ['main/**/*.spec.ts'],
    environment: 'node',
    // Keep each test isolated — BackendManager has module-level env lookups.
    isolate: true,
    testTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'renderer', 'src'),
    },
  },
});
