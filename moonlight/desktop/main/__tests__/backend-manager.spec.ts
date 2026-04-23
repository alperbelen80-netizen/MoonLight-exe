import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';
import { EventEmitter } from 'events';
import { Readable } from 'stream';

// ---- Mock electron BEFORE importing BackendManager -----------------------
vi.mock('electron', () => ({
  app: {
    getPath: (k: string) =>
      k === 'logs' ? '/tmp/moonlight-test-logs' : '/tmp/moonlight-test',
  },
}));

// ---- Mock child_process.spawn --------------------------------------------
interface FakeProc extends EventEmitter {
  pid: number;
  exitCode: number | null;
  stdout: Readable;
  stderr: Readable;
  kill: (sig?: string) => boolean;
  simulateExit: (code: number, signal?: string | null) => void;
}

const spawnedProcs: FakeProc[] = [];
function makeFakeProc(): FakeProc {
  const ee = new EventEmitter() as FakeProc;
  ee.pid = 99000 + spawnedProcs.length;
  ee.exitCode = null;
  ee.stdout = new Readable({ read() {} });
  ee.stderr = new Readable({ read() {} });
  ee.kill = (sig = 'SIGTERM') => {
    setImmediate(() => ee.simulateExit(sig === 'SIGKILL' ? 137 : 0, sig));
    return true;
  };
  ee.simulateExit = (code: number, signal?: string | null) => {
    if (ee.exitCode !== null) return;
    ee.exitCode = code;
    ee.stdout.push(null);
    ee.stderr.push(null);
    ee.emit('exit', code, signal ?? null);
  };
  spawnedProcs.push(ee);
  return ee;
}

vi.mock('child_process', () => ({
  spawn: vi.fn(() => makeFakeProc()),
}));

const { BackendManager } = await import('../backend-manager');

// Test subclass: skips real OS port probing and always returns the given
// port. This lets us point the BackendManager at a fake health server
// deterministically.
class TestBackendManager extends BackendManager {
  forcedPort: number;
  constructor(forcedPort: number, opts: ConstructorParameters<typeof BackendManager>[0]) {
    super(opts);
    this.forcedPort = forcedPort;
  }
  protected async pickFreePort(_preferred: number): Promise<number> {
    return this.forcedPort;
  }
}

fs.mkdirSync('/tmp/moonlight-test-logs', { recursive: true });

function startFakeHealthServer(): Promise<{
  port: number;
  stop: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      resolve({
        port: addr.port,
        stop: () =>
          new Promise((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

const DUMMY_BUNDLE = '/tmp/moonlight-test-bundle.js';
fs.writeFileSync(DUMMY_BUNDLE, '// dummy');

describe('BackendManager (v2.6-1)', () => {
  beforeEach(() => {
    spawnedProcs.length = 0;
    process.env.MOONLIGHT_BACKEND_ENTRY = DUMMY_BUNDLE;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.MOONLIGHT_BACKEND_ENTRY;
  });

  it('initial status: not running, null port/pid', () => {
    const mgr = new BackendManager();
    const s = mgr.getStatus();
    expect(s.running).toBe(false);
    expect(s.port).toBeNull();
    expect(s.pid).toBeNull();
    expect(s.startedAtMs).toBeNull();
  });

  it('resolveBackendEntry honours MOONLIGHT_BACKEND_ENTRY override', async () => {
    const fake = await startFakeHealthServer();
    const mgr = new TestBackendManager(fake.port, {
      preferredPort: fake.port,
      healthMaxRetries: 5,
      healthRetryDelayMs: 20,
    });
    const port = await mgr.start();
    expect(port).toBe(fake.port);
    expect(mgr.getStatus().backendEntry).toBe(DUMMY_BUNDLE);
    expect(mgr.getStatus().running).toBe(true);
    await mgr.stop();
    await fake.stop();
  });

  it('throws when bundle entry cannot be resolved', async () => {
    delete process.env.MOONLIGHT_BACKEND_ENTRY;
    // dev fallback path won't exist in the test filesystem location.
    const mgr = new BackendManager({ preferredPort: 0 });
    await expect(mgr.start()).rejects.toThrow(/backend bundle not found/);
  });

  it('start() rejects when the child process exits during boot', async () => {
    const fake = await startFakeHealthServer();
    const mgr = new TestBackendManager(fake.port + 10000, {
      preferredPort: fake.port + 10000, // nothing listening here
      healthMaxRetries: 30,
      healthRetryDelayMs: 10,
    });
    await fake.stop();
    const p = mgr.start();
    // Let the spawn call land, then simulate an unexpected crash.
    await new Promise((r) => setImmediate(r));
    spawnedProcs[spawnedProcs.length - 1]?.simulateExit(7, null);
    await expect(p).rejects.toThrow(/crashed during startup/);
  });

  it('start() rejects when health never goes green', async () => {
    const mgr = new TestBackendManager(39999, {
      preferredPort: 39999, // nothing listening
      healthMaxRetries: 3,
      healthRetryDelayMs: 10,
    });
    await expect(mgr.start()).rejects.toThrow(/did not become healthy/);
    expect(mgr.getStatus().running).toBe(false);
  });

  it('stop() is a safe no-op when never started', async () => {
    const mgr = new BackendManager();
    await expect(mgr.stop()).resolves.toBeUndefined();
  });

  it('stop() tears down the child process and clears status', async () => {
    const fake = await startFakeHealthServer();
    const mgr = new TestBackendManager(fake.port, {
      preferredPort: fake.port,
      healthMaxRetries: 5,
      healthRetryDelayMs: 20,
    });
    await mgr.start();
    expect(mgr.getStatus().running).toBe(true);
    await mgr.stop();
    expect(mgr.getStatus().running).toBe(false);
    await fake.stop();
  });

  it('start() is idempotent while backend is already running', async () => {
    const fake = await startFakeHealthServer();
    const mgr = new TestBackendManager(fake.port, {
      preferredPort: fake.port,
      healthMaxRetries: 5,
      healthRetryDelayMs: 20,
    });
    const firstPort = await mgr.start();
    const secondPort = await mgr.start();
    expect(secondPort).toBe(firstPort);
    expect(spawnedProcs.length).toBe(1);
    await mgr.stop();
    await fake.stop();
  });

  it('status.pid reflects the spawned child after successful start', async () => {
    const fake = await startFakeHealthServer();
    const mgr = new TestBackendManager(fake.port, {
      preferredPort: fake.port,
      healthMaxRetries: 5,
      healthRetryDelayMs: 20,
    });
    await mgr.start();
    const s = mgr.getStatus();
    expect(s.pid).toBeGreaterThanOrEqual(99000);
    expect(s.startedAtMs).toBeGreaterThan(0);
    await mgr.stop();
    await fake.stop();
  });
});
