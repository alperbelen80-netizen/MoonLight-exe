import {
  RuntimeFlagsService,
  REGISTERED_FLAGS,
} from '../../../runtime-flags/runtime-flags.module';
import { SecretsStoreService } from '../../../security/secrets-store.service';

/**
 * V2.6-7 RuntimeFlagsService unit tests.
 *
 * These tests use an in-memory stub for SecretsStoreService so we can
 * exercise the vault round-trip without initialising the real keytar/AES
 * stack. The important invariants we lock in:
 *
 *   - list() returns every registered flag, default values when absent.
 *   - set() persists to vault AND mutates process.env (hot-reload).
 *   - dangerous flags (`BROKER_DOM_ALLOW_LIVE_REAL`) require an
 *     explicit acknowledge flag.
 *   - unknown flag names are rejected.
 *   - bool / number / enum validation.
 *   - reset() deletes from vault and restores defaults.
 *   - audit trail caps at a sensible size (we just verify the last N
 *     entries are available).
 */

class InMemorySecrets {
  private store = new Map<string, string>();
  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
    return { ok: true, backend: 'memory' };
  }
  async delete(key: string) {
    return this.store.delete(key);
  }
  async list() {
    return Array.from(this.store.keys()).map((k) => ({ key: k, backend: 'memory' }));
  }
}

function freshSvc(): RuntimeFlagsService {
  const secrets = new InMemorySecrets() as unknown as SecretsStoreService;
  return new RuntimeFlagsService(secrets);
}

describe('RuntimeFlagsService (v2.6-7)', () => {
  beforeEach(() => {
    // Isolate env mutations.
    for (const def of REGISTERED_FLAGS) {
      delete process.env[def.name];
    }
  });

  afterAll(() => {
    for (const def of REGISTERED_FLAGS) {
      delete process.env[def.name];
    }
  });

  it('list() returns every registered flag with default when env empty', () => {
    const s = freshSvc();
    const flags = s.list();
    expect(flags.length).toBe(REGISTERED_FLAGS.length);
    for (const f of flags) {
      expect(f.isDefault).toBe(true);
      expect(f.value).toBe(f.definition.default);
    }
  });

  it('set() persists + hot-reloads process.env', async () => {
    const s = freshSvc();
    const r = await s.set('BROKER_DOM_MAX_STAKE', '10', 'unit-test');
    expect(r.value).toBe('10');
    expect(process.env.BROKER_DOM_MAX_STAKE).toBe('10');
    const list = s.list();
    const row = list.find((x) => x.name === 'BROKER_DOM_MAX_STAKE');
    expect(row?.isDefault).toBe(false);
    expect(row?.value).toBe('10');
  });

  it('rejects unknown flag names', async () => {
    const s = freshSvc();
    await expect(
      s.set('DEFINITELY_NOT_A_FLAG', 'yes', 'tester'),
    ).rejects.toThrow(/unknown flag/);
  });

  it('validates bool type', async () => {
    const s = freshSvc();
    await expect(
      s.set('BROKER_IQOPTION_REAL_ENABLED', 'maybe', 'tester'),
    ).rejects.toThrow(/bool/);
    const ok = await s.set('BROKER_IQOPTION_REAL_ENABLED', 'true', 'tester');
    expect(ok.value).toBe('true');
  });

  it('validates number type', async () => {
    const s = freshSvc();
    await expect(
      s.set('BROKER_DOM_MAX_STAKE', 'not-a-number', 'tester'),
    ).rejects.toThrow(/number/);
    await expect(
      s.set('BROKER_DOM_MAX_STAKE', '5', 'tester'),
    ).resolves.toBeDefined();
  });

  it('validates enum type against allowedValues', async () => {
    const s = freshSvc();
    await expect(
      s.set('PAYOUT_PROVIDER', 'WHATEVER', 'tester'),
    ).rejects.toThrow(/must be one of/);
    const ok = await s.set('PAYOUT_PROVIDER', 'DYNAMIC', 'tester');
    expect(ok.value).toBe('DYNAMIC');
  });

  it('requires acknowledge for BROKER_DOM_ALLOW_LIVE_REAL=true', async () => {
    const s = freshSvc();
    await expect(
      s.set('BROKER_DOM_ALLOW_LIVE_REAL', 'true', 'tester'),
    ).rejects.toThrow(/acknowledge_real_money/);
    const ok = await s.set(
      'BROKER_DOM_ALLOW_LIVE_REAL',
      'true',
      'tester',
      true,
    );
    expect(ok.value).toBe('true');
  });

  it('can set the dangerous flag to false without acknowledge', async () => {
    const s = freshSvc();
    await expect(
      s.set('BROKER_DOM_ALLOW_LIVE_REAL', 'false', 'tester'),
    ).resolves.toBeDefined();
  });

  it('reset() restores defaults and purges vault entries', async () => {
    const s = freshSvc();
    await s.set('BROKER_DOM_MAX_STAKE', '7', 'tester');
    await s.set('BROKER_IQOPTION_REAL_ENABLED', 'true', 'tester');
    const resetCount = await s.reset('tester');
    expect(resetCount).toBeGreaterThanOrEqual(2);
    expect(process.env.BROKER_DOM_MAX_STAKE).toBe('25');
    expect(process.env.BROKER_IQOPTION_REAL_ENABLED).toBe('false');
  });

  it('records audit entries on every change', async () => {
    const s = freshSvc();
    await s.set('BROKER_DOM_MAX_STAKE', '15', 'alice');
    await s.set('BROKER_DOM_MAX_STAKE', '20', 'bob');
    const audit = s.getAudit(10);
    expect(audit.length).toBeGreaterThanOrEqual(2);
    // Newest first.
    expect(audit[0].newValue).toBe('20');
    expect(audit[0].actor).toBe('bob');
  });

  it('onChange emits on each set', async () => {
    const s = freshSvc();
    const events: string[] = [];
    const off = s.onChange((e) => events.push(e.name));
    await s.set('BROKER_DOM_MAX_STAKE', '12', 'tester');
    expect(events).toContain('BROKER_DOM_MAX_STAKE');
    off();
  });
});
