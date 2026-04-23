import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { SecretsStoreService } from '../../security/secrets-store.service';

export interface BrokerCredentialSet {
  brokerId: string;
  hasCredentials: boolean;
  fields: Record<string, boolean>;
}

export interface IQOptionCreds {
  ssid: string;
  balanceId: number;
  wsUrl: string;
}
export interface OlympTradeCreds {
  email: string;
  password: string;
  loginUrl: string;
  headless: boolean;
}
export interface BinomoCreds {
  authToken: string;
  deviceId: string;
  wsUrl: string;
}
export interface ExpertOptionCreds {
  token: string;
  wsUrl: string;
}

/**
 * BrokerCredentialsService (v2.6-2 vault-first)
 *
 * Source-of-truth priority per field:
 *   1. SecretsStoreService (OS keychain / AES-256-GCM file) — cached locally
 *   2. process.env                                           — dev/CI only
 *
 * In packaged mode (`MOONLIGHT_PACKAGED=true`) with `MOONLIGHT_VAULT_STRICT=true`,
 * env-only values are REFUSED. Callers get `present=false` until the operator
 * populates the vault via the Settings UI. This closes the
 * plaintext-.env-travelling-with-the-installer hole.
 *
 * Typed accessors remain synchronous so existing adapters don't need to
 * await. `refresh()` re-hydrates the cache from the vault.
 */
@Injectable()
export class BrokerCredentialsService implements OnModuleInit {
  private readonly logger = new Logger(BrokerCredentialsService.name);
  private cache: Record<string, string> = {};
  private vaultBackend: 'keytar' | 'file' | 'none' = 'none';

  constructor(
    @Optional() private readonly vault: SecretsStoreService | null = null,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.vault) {
      this.vaultBackend = this.vault.backendName();
      await this.refresh();
    }
  }

  isMockMode(): boolean {
    return process.env.BROKER_MOCK_MODE === 'true';
  }

  isPackaged(): boolean {
    return process.env.MOONLIGHT_PACKAGED === 'true';
  }

  isVaultStrict(): boolean {
    // In packaged mode, vault-strict is ON by default.
    const raw = process.env.MOONLIGHT_VAULT_STRICT;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return this.isPackaged();
  }

  /** Re-read every tracked key from the vault into the local cache. */
  async refresh(): Promise<void> {
    if (!this.vault) return;
    const keys = [
      'IQ_OPTION_SSID',
      'IQ_OPTION_BALANCE_ID',
      'IQ_OPTION_WS_URL',
      'OLYMP_TRADE_EMAIL',
      'OLYMP_TRADE_PASSWORD',
      'OLYMP_TRADE_LOGIN_URL',
      'OLYMP_TRADE_HEADLESS',
      'BINOMO_AUTH_TOKEN',
      'BINOMO_DEVICE_ID',
      'BINOMO_WS_URL',
      'EXPERT_OPTION_TOKEN',
      'EXPERT_OPTION_WS_URL',
    ];
    const next: Record<string, string> = {};
    for (const k of keys) {
      try {
        const v = await this.vault.get(k, 'broker-credentials');
        if (v !== null && v !== undefined) next[k] = v;
      } catch (err) {
        this.logger.warn(
          `vault read failed for ${k}: ${(err as Error).message}`,
        );
      }
    }
    this.cache = next;
    this.logger.log(
      `vault-backed credentials refreshed (backend=${this.vaultBackend}, ` +
        `keys=${Object.keys(next).length})`,
    );
  }

  /**
   * Read a single credential field, applying the vault-first + strict
   * packaged policy.
   */
  private readField(key: string): string {
    const fromVault = this.cache[key];
    if (fromVault && fromVault.length > 0) return fromVault;
    // Strict mode: never fall through to env.
    if (this.isVaultStrict()) return '';
    return process.env[key] || '';
  }

  getIQOption(): { creds: IQOptionCreds | null; present: boolean } {
    const ssid = this.readField('IQ_OPTION_SSID');
    const balanceId = parseInt(this.readField('IQ_OPTION_BALANCE_ID') || '0', 10);
    const wsUrl =
      this.readField('IQ_OPTION_WS_URL') ||
      'wss://iqoption.com/echo/websocket';
    const present = !!ssid && balanceId > 0;
    return {
      present,
      creds: present ? { ssid, balanceId, wsUrl } : null,
    };
  }

  getOlympTrade(): { creds: OlympTradeCreds | null; present: boolean } {
    const email = this.readField('OLYMP_TRADE_EMAIL');
    const password = this.readField('OLYMP_TRADE_PASSWORD');
    const loginUrl =
      this.readField('OLYMP_TRADE_LOGIN_URL') ||
      'https://olymptrade.com/en/login';
    const headless =
      (this.readField('OLYMP_TRADE_HEADLESS') || 'true') === 'true';
    const present = !!email && !!password;
    return {
      present,
      creds: present ? { email, password, loginUrl, headless } : null,
    };
  }

  getBinomo(): { creds: BinomoCreds | null; present: boolean } {
    const authToken = this.readField('BINOMO_AUTH_TOKEN');
    const deviceId = this.readField('BINOMO_DEVICE_ID');
    const wsUrl = this.readField('BINOMO_WS_URL') || 'wss://ws.binomo.com/';
    const present = !!authToken;
    return {
      present,
      creds: present ? { authToken, deviceId, wsUrl } : null,
    };
  }

  getExpertOption(): { creds: ExpertOptionCreds | null; present: boolean } {
    const token = this.readField('EXPERT_OPTION_TOKEN');
    const wsUrl =
      this.readField('EXPERT_OPTION_WS_URL') ||
      'wss://fr24g1us0.expertoption.com/';
    const present = !!token;
    return {
      present,
      creds: present ? { token, wsUrl } : null,
    };
  }

  summary(): BrokerCredentialSet[] {
    const has = (k: string): boolean => {
      const inVault = !!this.cache[k];
      if (inVault) return true;
      if (this.isVaultStrict()) return false;
      return !!process.env[k];
    };
    return [
      {
        brokerId: 'IQ_OPTION',
        hasCredentials: this.getIQOption().present,
        fields: {
          IQ_OPTION_SSID: has('IQ_OPTION_SSID'),
          IQ_OPTION_BALANCE_ID: has('IQ_OPTION_BALANCE_ID'),
        },
      },
      {
        brokerId: 'OLYMP_TRADE',
        hasCredentials: this.getOlympTrade().present,
        fields: {
          OLYMP_TRADE_EMAIL: has('OLYMP_TRADE_EMAIL'),
          OLYMP_TRADE_PASSWORD: has('OLYMP_TRADE_PASSWORD'),
        },
      },
      {
        brokerId: 'BINOMO',
        hasCredentials: this.getBinomo().present,
        fields: {
          BINOMO_AUTH_TOKEN: has('BINOMO_AUTH_TOKEN'),
          BINOMO_DEVICE_ID: has('BINOMO_DEVICE_ID'),
        },
      },
      {
        brokerId: 'EXPERT_OPTION',
        hasCredentials: this.getExpertOption().present,
        fields: {
          EXPERT_OPTION_TOKEN: has('EXPERT_OPTION_TOKEN'),
        },
      },
    ];
  }

  /** Introspection for operators / diagnostics (never secret values). */
  getDiagnostics(): {
    vaultBackend: 'keytar' | 'file' | 'none';
    vaultStrict: boolean;
    packaged: boolean;
    cachedKeyCount: number;
  } {
    return {
      vaultBackend: this.vaultBackend,
      vaultStrict: this.isVaultStrict(),
      packaged: this.isPackaged(),
      cachedKeyCount: Object.keys(this.cache).length,
    };
  }
}
