import { BrokerCredentialsService } from '../../../broker/adapters/broker-credentials.service';

describe('BrokerCredentialsService', () => {
  let svc: BrokerCredentialsService;

  beforeEach(() => {
    // Clear broker env vars to get a clean state
    delete process.env.IQ_OPTION_SSID;
    delete process.env.IQ_OPTION_BALANCE_ID;
    delete process.env.OLYMP_TRADE_EMAIL;
    delete process.env.OLYMP_TRADE_PASSWORD;
    delete process.env.BINOMO_AUTH_TOKEN;
    delete process.env.EXPERT_OPTION_TOKEN;
    delete process.env.BROKER_MOCK_MODE;
    svc = new BrokerCredentialsService();
  });

  it('defaults all brokers to not-present', () => {
    const summary = svc.summary();
    for (const s of summary) {
      expect(s.hasCredentials).toBe(false);
    }
  });

  it('detects IQ Option when both SSID and BALANCE_ID present', () => {
    process.env.IQ_OPTION_SSID = 'abc';
    process.env.IQ_OPTION_BALANCE_ID = '5';
    expect(svc.getIQOption().present).toBe(true);
    expect(svc.getIQOption().creds?.balanceId).toBe(5);
  });

  it('returns null creds when Binomo token missing', () => {
    expect(svc.getBinomo().present).toBe(false);
    expect(svc.getBinomo().creds).toBeNull();
  });

  it('respects BROKER_MOCK_MODE flag', () => {
    expect(svc.isMockMode()).toBe(false);
    process.env.BROKER_MOCK_MODE = 'true';
    expect(svc.isMockMode()).toBe(true);
  });
});
