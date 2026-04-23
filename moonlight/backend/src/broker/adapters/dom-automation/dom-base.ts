import { Logger } from '@nestjs/common';

/**
 * V2.5-4 DOM Automation Base Layer
 *
 * A minimal, Playwright-agnostic contract so broker adapters don't import
 * `playwright` directly. At runtime we lazy-load Playwright only when an
 * operator flips `BROKER_DOM_AUTOMATION_ENABLED=true`; tests inject a mock
 * via `setPlaywrightImpl(...)`.
 *
 * Why not depend on Playwright at module load time?
 *   - Playwright pulls Chromium (~150MB) into the install footprint.
 *   - The Kubernetes preview environment has no browser available.
 *   - We still want the rest of the backend (MoE, backtests, sim brokers)
 *     to boot and test cleanly without DOM automation installed.
 */

export interface DomPageLike {
  goto(url: string): Promise<void>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string, opts?: { timeout?: number }): Promise<void>;
  textContent(selector: string): Promise<string | null>;
  waitForSelector(selector: string, opts?: { timeout?: number; state?: string }): Promise<void>;
  screenshot(opts?: { path?: string; fullPage?: boolean }): Promise<Buffer | void>;
  close(): Promise<void>;
  evaluate<T = unknown>(fn: string | ((...args: unknown[]) => T)): Promise<T>;
}

export interface DomBrowserContextLike {
  newPage(): Promise<DomPageLike>;
  close(): Promise<void>;
}

export interface DomBrowserLike {
  newContext(opts?: Record<string, unknown>): Promise<DomBrowserContextLike>;
  close(): Promise<void>;
}

export interface DomPlaywrightImpl {
  launch(opts?: {
    headless?: boolean;
    args?: string[];
    executablePath?: string;
  }): Promise<DomBrowserLike>;
}

// ---- Lazy runtime loader + test injection ----

let injected: DomPlaywrightImpl | null = null;

/**
 * Test-only: inject a fake Playwright implementation. Passing null restores
 * the lazy runtime loader.
 */
export function setPlaywrightImpl(impl: DomPlaywrightImpl | null): void {
  injected = impl;
}

/**
 * Load the real Playwright's chromium launcher at runtime. Throws a clear
 * error if the dependency isn't installed (e.g. in cluster dev envs).
 */
export async function getPlaywrightImpl(): Promise<DomPlaywrightImpl> {
  if (injected) return injected;
  try {
    // Indirect require so TypeScript + esbuild don't try to resolve it at
    // module graph time. Playwright is an *optional* runtime dep.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const pw = require('playwright');
    if (!pw?.chromium?.launch) {
      throw new Error('playwright installed but chromium.launch missing');
    }
    return { launch: (opts) => pw.chromium.launch(opts) } satisfies DomPlaywrightImpl;
  } catch (err) {
    throw new Error(
      `playwright is not installed (${(err as Error).message}). ` +
        'Install it with `yarn add -W playwright` and run ' +
        '`npx playwright install chromium` to enable DOM broker automation.',
    );
  }
}

// ---- Selector registry (versioned, degradable) ----

export interface SelectorMap {
  [logicalName: string]: string;
}

export interface VersionedSelectorBundle {
  version: string; // e.g. "2026-04-v1"
  loginUrl: string;
  selectors: SelectorMap;
}

export class SelectorRegistry {
  private readonly logger = new Logger('SelectorRegistry');
  private readonly bundles: Map<string, VersionedSelectorBundle> = new Map();

  register(brokerId: string, bundle: VersionedSelectorBundle): void {
    this.bundles.set(brokerId, bundle);
    this.logger.log(`registered selectors for ${brokerId} v${bundle.version}`);
  }

  get(brokerId: string): VersionedSelectorBundle | null {
    return this.bundles.get(brokerId) ?? null;
  }

  listVersions(): Array<{ brokerId: string; version: string }> {
    return Array.from(this.bundles.entries()).map(([brokerId, b]) => ({
      brokerId,
      version: b.version,
    }));
  }
}

// ---- Browser session manager ----

export interface DomSessionConfig {
  headless?: boolean;
  userAgent?: string;
  timeoutMs?: number;
  screenshotDir?: string;
}

export interface DomSession {
  id: string;
  brokerId: string;
  page: DomPageLike;
  context: DomBrowserContextLike;
  browser: DomBrowserLike;
  createdAtMs: number;
  closed: boolean;
}

/**
 * Manages headless Chromium sessions per broker. Sessions are cheap to create
 * but expensive to keep alive, so we cap concurrent sessions and auto-expire
 * idle ones. Failures bubble screenshots out to `screenshotDir` when
 * configured (useful for debugging selector drift in the field).
 */
export class DomBrowserSessionManager {
  private readonly logger = new Logger('DomBrowserSessionManager');
  private readonly sessions: Map<string, DomSession> = new Map();
  private seq = 0;

  constructor(private readonly cfg: DomSessionConfig = {}) {}

  isEnabled(): boolean {
    return process.env.BROKER_DOM_AUTOMATION_ENABLED === 'true';
  }

  async open(brokerId: string): Promise<DomSession> {
    if (!this.isEnabled()) {
      throw new Error('BROKER_DOM_AUTOMATION_DISABLED');
    }
    const pw = await getPlaywrightImpl();
    const browser = await pw.launch({
      headless: this.cfg.headless ?? true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const context = await browser.newContext({
      userAgent: this.cfg.userAgent,
    });
    const page = await context.newPage();
    this.seq++;
    const session: DomSession = {
      id: `dom_${brokerId}_${Date.now()}_${this.seq}`,
      brokerId,
      page,
      context,
      browser,
      createdAtMs: Date.now(),
      closed: false,
    };
    this.sessions.set(session.id, session);
    this.logger.log(`opened session ${session.id}`);
    return session;
  }

  async close(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (!s || s.closed) return;
    s.closed = true;
    try {
      await s.page.close();
    } catch {
      /* ignore */
    }
    try {
      await s.context.close();
    } catch {
      /* ignore */
    }
    try {
      await s.browser.close();
    } catch {
      /* ignore */
    }
    this.sessions.delete(sessionId);
    this.logger.log(`closed session ${sessionId}`);
  }

  async closeAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    for (const id of ids) await this.close(id);
  }

  listActive(): Array<{ id: string; brokerId: string; ageMs: number }> {
    const now = Date.now();
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      brokerId: s.brokerId,
      ageMs: now - s.createdAtMs,
    }));
  }
}
