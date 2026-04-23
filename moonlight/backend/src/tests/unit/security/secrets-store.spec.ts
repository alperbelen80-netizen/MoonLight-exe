import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SecretsStoreService } from '../../../security/secrets-store.service';

/**
 * V2.6-2 SecretsStoreService — full coverage:
 *   - file-backend round-trip (write, read, overwrite, delete)
 *   - AES-256-GCM tamper detection
 *   - machine-bound key (corrupted file → fail-closed decrypt)
 *   - key validator (rejects bad identifiers)
 *   - preview never returns the full value
 *   - audit trail (set/get/delete/list all logged, bounded)
 *   - `has()` semantics
 */
describe('SecretsStoreService (V2.6-2)', () => {
  const originalEnv = { ...process.env };
  let vaultPath: string;

  beforeEach(() => {
    // Always use file backend in tests (no real keychain).
    process.env.MOONLIGHT_VAULT_FORCE_FILE = 'true';
    vaultPath = path.join(
      os.tmpdir(),
      `moonlight-vault-${Date.now()}-${Math.random().toString(36).slice(2)}.enc`,
    );
    process.env.MOONLIGHT_VAULT_PATH = vaultPath;
  });

  afterEach(async () => {
    try {
      if (fs.existsSync(vaultPath)) fs.unlinkSync(vaultPath);
    } catch {
      /* ignore */
    }
    process.env = { ...originalEnv };
  });

  it('starts with the file backend when keytar is forced off', () => {
    const s = new SecretsStoreService();
    expect(s.backendName()).toBe('file');
    expect(s.isHardened()).toBe(false);
  });

  it('set → get round-trip survives the file encrypt/decrypt', async () => {
    const s = new SecretsStoreService();
    const meta = await s.set('IQ_OPTION_SSID', 'ssid_value_1234', 'test-actor');
    expect(meta.backend).toBe('file');
    expect(meta.preview).toBe('****1234'); // last 4 masked format
    expect(meta.length).toBe(15);
    const got = await s.get('IQ_OPTION_SSID', 'test-actor');
    expect(got).toBe('ssid_value_1234');
  });

  it('set overwrites existing value', async () => {
    const s = new SecretsStoreService();
    await s.set('IQ_OPTION_SSID', 'v1');
    await s.set('IQ_OPTION_SSID', 'v2_longer');
    const got = await s.get('IQ_OPTION_SSID');
    expect(got).toBe('v2_longer');
  });

  it('delete removes the secret and returns true; missing key → false', async () => {
    const s = new SecretsStoreService();
    await s.set('BINOMO_AUTH_TOKEN', 'tok');
    expect(await s.delete('BINOMO_AUTH_TOKEN')).toBe(true);
    expect(await s.get('BINOMO_AUTH_TOKEN')).toBeNull();
    expect(await s.delete('BINOMO_AUTH_TOKEN')).toBe(false);
  });

  it('has() returns false for missing / empty, true for set values', async () => {
    const s = new SecretsStoreService();
    expect(await s.has('OLYMP_TRADE_EMAIL')).toBe(false);
    await s.set('OLYMP_TRADE_EMAIL', 'x@y');
    expect(await s.has('OLYMP_TRADE_EMAIL')).toBe(true);
  });

  it('list() enumerates keys via the file sidecar, with masked previews', async () => {
    const s = new SecretsStoreService();
    await s.set('IQ_OPTION_SSID', 'longenough');
    await s.set('OLYMP_TRADE_EMAIL', 'x@y');
    const items = await s.list();
    const keys = items.map((i) => i.key).sort();
    expect(keys).toEqual(['IQ_OPTION_SSID', 'OLYMP_TRADE_EMAIL']);
    const ssid = items.find((i) => i.key === 'IQ_OPTION_SSID')!;
    expect(ssid.preview).toBe('****ough');
    expect(ssid.preview).not.toContain('longen'); // never leaks prefix
  });

  it('rejects invalid keys at validation time', async () => {
    const s = new SecretsStoreService();
    await expect(s.set('lowercase', 'v')).rejects.toThrow(/secret key must match/);
    await expect(s.set('A', 'v')).rejects.toThrow(/secret key must match/);
    await expect(s.set('HAS SPACES', 'v')).rejects.toThrow(/secret key must match/);
    await expect(s.set('TOO_LONG_'.padEnd(70, 'X'), 'v')).rejects.toThrow(
      /secret key must match/,
    );
  });

  it('rejects empty secret values', async () => {
    const s = new SecretsStoreService();
    await expect(s.set('IQ_OPTION_SSID', '')).rejects.toThrow(
      /non-empty string/,
    );
  });

  it('corrupting the file fails closed on next decrypt attempt', async () => {
    const s1 = new SecretsStoreService();
    await s1.set('IQ_OPTION_SSID', 'legit');

    // Tamper with the authentication tag (bytes 12-27) — GCM will refuse.
    const buf = fs.readFileSync(vaultPath);
    buf[15] = buf[15] ^ 0xff;
    fs.writeFileSync(vaultPath, buf);

    // Fresh service (no in-memory cache).
    const s2 = new SecretsStoreService();
    await expect(s2.get('IQ_OPTION_SSID')).rejects.toThrow(
      /vault decrypt failed/,
    );
  });

  it('writes audit trail entries for set/get/delete', async () => {
    const s = new SecretsStoreService();
    await s.set('IQ_OPTION_SSID', 'v', 'u1');
    await s.get('IQ_OPTION_SSID', 'u1');
    await s.delete('IQ_OPTION_SSID', 'u1');
    const audit = s.getAuditTrail(10);
    const actions = audit.map((e) => e.action);
    expect(actions).toContain('set');
    expect(actions).toContain('get');
    expect(actions).toContain('delete');
    // Every entry is marked `ok: true` for the happy path.
    expect(audit.every((e) => e.ok)).toBe(true);
    // Audit NEVER contains the value.
    for (const e of audit) {
      expect(JSON.stringify(e)).not.toContain('\"v\"');
    }
  });

  it('audit trail captures failures with a reason', async () => {
    const s = new SecretsStoreService();
    await expect(s.set('bad lowercase', 'v')).rejects.toThrow();
    const audit = s.getAuditTrail(10);
    const failed = audit.find((e) => e.ok === false);
    expect(failed).toBeDefined();
    expect(failed?.action).toBe('set');
    expect(failed?.reason).toMatch(/secret key must match/);
  });

  it('preview masking: short values never leak, long values show only last 4', async () => {
    const s = new SecretsStoreService();
    const short = await s.set('SHORT_KEY', 'ab');
    expect(short.preview).toBe('****');
    const long = await s.set('LONG_KEY', 'abcdefghijklmno');
    expect(long.preview).toBe('****lmno');
    // Never contains the leading chars.
    expect(long.preview).not.toContain('abcde');
  });

  it('keytar path: loaded → backend switches to keytar', async () => {
    // Flip the override so loadKeytar() attempts require('keytar').
    delete process.env.MOONLIGHT_VAULT_FORCE_FILE;

    const store: Record<string, string> = {};
    const fakeKeytar = {
      setPassword: jest.fn(
        async (_svc: string, account: string, password: string) => {
          store[account] = password;
        },
      ),
      getPassword: jest.fn(
        async (_svc: string, account: string) => store[account] ?? null,
      ),
      deletePassword: jest.fn(async (_svc: string, account: string) => {
        const had = account in store;
        delete store[account];
        return had;
      }),
      findCredentials: jest.fn(async () =>
        Object.entries(store).map(([account, password]) => ({ account, password })),
      ),
    };

    await jest.isolateModulesAsync(async () => {
      jest.doMock('keytar', () => fakeKeytar, { virtual: true });
      // Re-import the service inside the isolated module scope so its
      // lazy `require('keytar')` picks up the mock.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { SecretsStoreService: IsolatedSvc } = require('../../../security/secrets-store.service');
      const s = new IsolatedSvc();
      expect(s.backendName()).toBe('keytar');
      expect(s.isHardened()).toBe(true);
      await s.set('IQ_OPTION_SSID', 'keychain_value');
      expect(fakeKeytar.setPassword).toHaveBeenCalled();
      const v = await s.get('IQ_OPTION_SSID');
      expect(v).toBe('keychain_value');
      const items = await s.list();
      expect(items.map((i: { key: string }) => i.key)).toContain('IQ_OPTION_SSID');
    });
  });
});
