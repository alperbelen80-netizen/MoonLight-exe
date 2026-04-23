import { BrokerCredentialsService } from '../../../broker/adapters/broker-credentials.service';
import { SecretsStoreService } from '../../../security/secrets-store.service';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * V2.6-2 BrokerCredentialsService tests.
 *
 * Verifies:
 *   - vault-first: if the vault has a value, env is ignored
 *   - env fallback in non-strict (dev) mode
 *   - strict mode (packaged): env is REFUSED — vault-only
 *   - refresh() re-hydrates the cache
 *   - summary()/getDiagnostics() never leak values
 */
describe('BrokerCredentialsService (V2.6-2)', () => {
  const originalEnv = { ...process.env };
  let vaultPath: string;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.MOONLIGHT_VAULT_FORCE_FILE = 'true';
    vaultPath = path.join(
      os.tmpdir(),
      `mlv-creds-${Date.now()}-${Math.random().toString(36).slice(2)}.enc`,
    );
    process.env.MOONLIGHT_VAULT_PATH = vaultPath;
    // Clear any stray broker credentials from outer env.
    for (const k of [
      'IQ_OPTION_SSID',
      'IQ_OPTION_BALANCE_ID',
      'OLYMP_TRADE_EMAIL',
      'OLYMP_TRADE_PASSWORD',
      'BINOMO_AUTH_TOKEN',
      'EXPERT_OPTION_TOKEN',
      'MOONLIGHT_PACKAGED',
      'MOONLIGHT_VAULT_STRICT',
    ]) {
      delete process.env[k];
    }
  });

  afterEach(() => {
    try {
      if (fs.existsSync(vaultPath)) fs.unlinkSync(vaultPath);
    } catch {
      /* ignore */
    }
    process.env = { ...originalEnv };
  });

  it('no vault, no env → all brokers report hasCredentials=false', async () => {
    const creds = new BrokerCredentialsService(null);
    await creds.onModuleInit();
    expect(creds.getIQOption().present).toBe(false);
    expect(creds.getOlympTrade().present).toBe(false);
    expect(creds.getBinomo().present).toBe(false);
    expect(creds.getExpertOption().present).toBe(false);
  });

  it('env-only credentials work in non-strict (dev) mode', async () => {
    process.env.IQ_OPTION_SSID = 'env_ssid';
    process.env.IQ_OPTION_BALANCE_ID = '42';
    const creds = new BrokerCredentialsService(null);
    await creds.onModuleInit();
    const iq = creds.getIQOption();
    expect(iq.present).toBe(true);
    expect(iq.creds?.ssid).toBe('env_ssid');
    expect(iq.creds?.balanceId).toBe(42);
  });

  it('strict mode (MOONLIGHT_VAULT_STRICT=true) refuses env-only creds', async () => {
    process.env.MOONLIGHT_VAULT_STRICT = 'true';
    process.env.IQ_OPTION_SSID = 'env_only';
    process.env.IQ_OPTION_BALANCE_ID = '42';
    const creds = new BrokerCredentialsService(null);
    await creds.onModuleInit();
    expect(creds.isVaultStrict()).toBe(true);
    expect(creds.getIQOption().present).toBe(false);
    // Summary reflects the gated fields.
    const iq = creds.summary().find((s) => s.brokerId === 'IQ_OPTION')!;
    expect(iq.hasCredentials).toBe(false);
    expect(iq.fields.IQ_OPTION_SSID).toBe(false);
  });

  it('packaged mode defaults to strict', async () => {
    process.env.MOONLIGHT_PACKAGED = 'true';
    const creds = new BrokerCredentialsService(null);
    await creds.onModuleInit();
    expect(creds.isPackaged()).toBe(true);
    expect(creds.isVaultStrict()).toBe(true);
  });

  it('vault-first: vault value wins over env', async () => {
    const vault = new SecretsStoreService();
    await vault.set('IQ_OPTION_SSID', 'vault_ssid');
    await vault.set('IQ_OPTION_BALANCE_ID', '7');
    process.env.IQ_OPTION_SSID = 'env_ssid_should_be_ignored';
    process.env.IQ_OPTION_BALANCE_ID = '99';

    const creds = new BrokerCredentialsService(vault);
    await creds.onModuleInit();
    const iq = creds.getIQOption();
    expect(iq.creds?.ssid).toBe('vault_ssid');
    expect(iq.creds?.balanceId).toBe(7);
  });

  it('refresh() picks up newly-written vault entries', async () => {
    const vault = new SecretsStoreService();
    const creds = new BrokerCredentialsService(vault);
    await creds.onModuleInit();
    expect(creds.getOlympTrade().present).toBe(false);

    await vault.set('OLYMP_TRADE_EMAIL', 'x@y');
    await vault.set('OLYMP_TRADE_PASSWORD', 'pw');
    await creds.refresh();
    expect(creds.getOlympTrade().present).toBe(true);
    expect(creds.getOlympTrade().creds?.email).toBe('x@y');
  });

  it('getDiagnostics never exposes values, only counts', async () => {
    const vault = new SecretsStoreService();
    await vault.set('IQ_OPTION_SSID', 'super_secret');
    await vault.set('IQ_OPTION_BALANCE_ID', '42');
    const creds = new BrokerCredentialsService(vault);
    await creds.onModuleInit();
    const diag = creds.getDiagnostics();
    expect(diag.cachedKeyCount).toBe(2);
    expect(JSON.stringify(diag)).not.toContain('super_secret');
  });

  it('summary() reflects vault-only in strict mode', async () => {
    process.env.MOONLIGHT_VAULT_STRICT = 'true';
    process.env.BINOMO_AUTH_TOKEN = 'env_binomo'; // should be ignored

    const vault = new SecretsStoreService();
    await vault.set('BINOMO_AUTH_TOKEN', 'vault_binomo');
    const creds = new BrokerCredentialsService(vault);
    await creds.onModuleInit();

    const b = creds.summary().find((s) => s.brokerId === 'BINOMO')!;
    expect(b.hasCredentials).toBe(true);
    expect(b.fields.BINOMO_AUTH_TOKEN).toBe(true);
    expect(creds.getBinomo().creds?.authToken).toBe('vault_binomo');
  });
});
