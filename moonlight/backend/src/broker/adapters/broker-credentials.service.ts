import { Injectable, Logger } from '@nestjs/common';

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
 * BrokerCredentialsService
 *
 * Central vault (env-backed) for all broker credentials. Reads from process.env
 * ONLY at construction time and surfaces them through typed accessors.
 *
 * Policy:
 *  - Never logs secret values.
 *  - Returns hasCredentials=false until user populates .env.
 *  - Adapter code MUST call the accessor and fail-closed when hasCredentials=false
 *    (unless running in MOCK mode with BROKER_MOCK_MODE=true).
 */
@Injectable()
export class BrokerCredentialsService {
  private readonly logger = new Logger(BrokerCredentialsService.name);

  isMockMode(): boolean {
    return process.env.BROKER_MOCK_MODE === 'true';
  }

  getIQOption(): { creds: IQOptionCreds | null; present: boolean } {
    const ssid = process.env.IQ_OPTION_SSID || '';
    const balanceId = parseInt(process.env.IQ_OPTION_BALANCE_ID || '0', 10);
    const wsUrl = process.env.IQ_OPTION_WS_URL || 'wss://iqoption.com/echo/websocket';
    const present = !!ssid && balanceId > 0;
    return {
      present,
      creds: present ? { ssid, balanceId, wsUrl } : null,
    };
  }

  getOlympTrade(): { creds: OlympTradeCreds | null; present: boolean } {
    const email = process.env.OLYMP_TRADE_EMAIL || '';
    const password = process.env.OLYMP_TRADE_PASSWORD || '';
    const loginUrl = process.env.OLYMP_TRADE_LOGIN_URL || 'https://olymptrade.com/en/login';
    const headless = (process.env.OLYMP_TRADE_HEADLESS || 'true') === 'true';
    const present = !!email && !!password;
    return {
      present,
      creds: present ? { email, password, loginUrl, headless } : null,
    };
  }

  getBinomo(): { creds: BinomoCreds | null; present: boolean } {
    const authToken = process.env.BINOMO_AUTH_TOKEN || '';
    const deviceId = process.env.BINOMO_DEVICE_ID || '';
    const wsUrl = process.env.BINOMO_WS_URL || 'wss://ws.binomo.com/';
    const present = !!authToken;
    return {
      present,
      creds: present ? { authToken, deviceId, wsUrl } : null,
    };
  }

  getExpertOption(): { creds: ExpertOptionCreds | null; present: boolean } {
    const token = process.env.EXPERT_OPTION_TOKEN || '';
    const wsUrl = process.env.EXPERT_OPTION_WS_URL || 'wss://fr24g1us0.expertoption.com/';
    const present = !!token;
    return {
      present,
      creds: present ? { token, wsUrl } : null,
    };
  }

  summary(): BrokerCredentialSet[] {
    return [
      {
        brokerId: 'IQ_OPTION',
        hasCredentials: this.getIQOption().present,
        fields: { IQ_OPTION_SSID: !!process.env.IQ_OPTION_SSID, IQ_OPTION_BALANCE_ID: !!process.env.IQ_OPTION_BALANCE_ID },
      },
      {
        brokerId: 'OLYMP_TRADE',
        hasCredentials: this.getOlympTrade().present,
        fields: {
          OLYMP_TRADE_EMAIL: !!process.env.OLYMP_TRADE_EMAIL,
          OLYMP_TRADE_PASSWORD: !!process.env.OLYMP_TRADE_PASSWORD,
        },
      },
      {
        brokerId: 'BINOMO',
        hasCredentials: this.getBinomo().present,
        fields: { BINOMO_AUTH_TOKEN: !!process.env.BINOMO_AUTH_TOKEN, BINOMO_DEVICE_ID: !!process.env.BINOMO_DEVICE_ID },
      },
      {
        brokerId: 'EXPERT_OPTION',
        hasCredentials: this.getExpertOption().present,
        fields: { EXPERT_OPTION_TOKEN: !!process.env.EXPERT_OPTION_TOKEN },
      },
    ];
  }
}
