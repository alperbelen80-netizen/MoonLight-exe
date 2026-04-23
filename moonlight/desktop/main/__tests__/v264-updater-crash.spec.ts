import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AutoUpdaterService } from '../auto-updater';
import { CrashReporterService } from '../crash-reporter';

// v2.6-4 smoke tests for AutoUpdater + CrashReporter in the Electron
// main process. We *mock* electron APIs lightly because the real ones
// require an Electron runtime we don't have in a vitest node env.

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getVersion: () => '2.6.4',
    getPath: (n: string) => `/tmp/moonlight-vitest-${n}`,
  },
  crashReporter: {
    start: vi.fn(),
  },
}));

describe('AutoUpdaterService (v2.6-4)', () => {
  beforeEach(() => {
    delete process.env.MOONLIGHT_AUTO_UPDATE_ENABLED;
  });

  it('disables in dev (non-packaged) by default', () => {
    const svc = new AutoUpdaterService();
    const s = svc.getStatus();
    expect(s.state).toBe('disabled');
    expect(s.available).toBe(false);
    expect(s.reason).toMatch(/non-packaged|disabled/);
    expect(s.currentVersion).toBe('2.6.4');
  });

  it('honors MOONLIGHT_AUTO_UPDATE_ENABLED=false explicitly', () => {
    process.env.MOONLIGHT_AUTO_UPDATE_ENABLED = 'false';
    const svc = new AutoUpdaterService();
    expect(svc.getStatus().state).toBe('disabled');
  });

  it('no-ops safely when disabled', async () => {
    const svc = new AutoUpdaterService();
    const before = svc.getStatus();
    const after = await svc.checkForUpdates();
    expect(after.state).toBe(before.state);
    // downloadUpdate + quitAndInstall should also just return status
    const d = await svc.downloadUpdate();
    expect(d.state).toBe('disabled');
    const q = svc.quitAndInstall();
    expect(q.state).toBe('disabled');
  });

  it('exposes channel + feedUrl shape', () => {
    process.env.MOONLIGHT_AUTO_UPDATE_ENABLED = 'false';
    process.env.MOONLIGHT_UPDATE_CHANNEL = 'beta';
    const svc = new AutoUpdaterService();
    expect(svc.getStatus().updateChannel).toBe('beta');
    delete process.env.MOONLIGHT_UPDATE_CHANNEL;
  });
});

describe('CrashReporterService (v2.6-4)', () => {
  it('records a backend crash and bumps history count', () => {
    const svc = new CrashReporterService();
    // Skip native start (needs real Electron); just exercise history API.
    const ev = svc.recordBackendCrash({
      code: 1,
      signal: null,
      lastError: 'boom',
      entry: '/bundle/backend.js',
      logFile: '/tmp/backend.log',
      uptimeMs: 3123,
    });
    expect(ev.kind).toBe('backend-exit');
    expect(ev.message).toBe('boom');
    expect(svc.getHistory(10).length).toBeGreaterThan(0);
  });

  it('classifies spawn failure differently from exit', () => {
    const svc = new CrashReporterService();
    const ev = svc.recordBackendCrash({
      code: null,
      signal: null,
      lastError: 'backend did not become healthy after 60000ms',
      entry: null,
      logFile: null,
      uptimeMs: null,
    });
    expect(ev.kind).toBe('backend-spawn-failure');
  });

  it('captures uncaught main exceptions', () => {
    const svc = new CrashReporterService();
    const err = new Error('main boom');
    const ev = svc.recordMainUncaught(err);
    expect(ev.kind).toBe('main-uncaught');
    expect(ev.message).toBe('main boom');
  });

  it('getStatus returns a safe default shape', () => {
    const svc = new CrashReporterService();
    const s = svc.getStatus();
    // Before start() historyFile may be null.
    expect(typeof s.enabled).toBe('boolean');
    expect(typeof s.historyCount).toBe('number');
  });
});
