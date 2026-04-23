import { IQOptionRealAdapter } from '../../../broker/adapters/iq-option-real.adapter';
import { BrokerCredentialsService } from '../../../broker/adapters/broker-credentials.service';
import { SessionHealth } from '../../../shared/enums/session-health.enum';
import {
  BrokerOrderRequestDTO,
  BrokerOrderStatus,
} from '../../../shared/dto/broker-order.dto';
import { SignalDirection } from '../../../shared/dto/canonical-signal.dto';

function baseRequest(): BrokerOrderRequestDTO {
  return {
    broker_request_id: 'req_1',
    order_key: 'k1',
    symbol: 'EURUSD',
    direction: SignalDirection.CALL,
    stake_amount: 10,
    expiry_minutes: 1,
    art_id: 'ART_1',
    account_id: 'ACC_DEMO',
    request_ts_utc: new Date().toISOString(),
  };
}

describe('IQOptionRealAdapter — V2.5-3 feature-flag guard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('isRealEnabled() returns false by default', () => {
    delete process.env.BROKER_IQOPTION_REAL_ENABLED;
    expect(IQOptionRealAdapter.isRealEnabled()).toBe(false);
  });

  it('isRealEnabled() is true only when flag === "true"', () => {
    process.env.BROKER_IQOPTION_REAL_ENABLED = 'true';
    expect(IQOptionRealAdapter.isRealEnabled()).toBe(true);

    process.env.BROKER_IQOPTION_REAL_ENABLED = '1';
    expect(IQOptionRealAdapter.isRealEnabled()).toBe(false);

    process.env.BROKER_IQOPTION_REAL_ENABLED = 'yes';
    expect(IQOptionRealAdapter.isRealEnabled()).toBe(false);
  });

  it('connectSession throws IQ_OPTION_REAL_DISABLED when flag off', async () => {
    delete process.env.BROKER_IQOPTION_REAL_ENABLED;
    const creds = new BrokerCredentialsService();
    const adapter = new IQOptionRealAdapter(creds);
    await expect(adapter.connectSession('ACC_1')).rejects.toThrow(
      /IQ_OPTION_REAL_DISABLED/,
    );
    expect(adapter.getSessionHealth()).toBe(SessionHealth.DOWN);
  });

  it('sendOrder returns REJECT REAL_DISABLED when flag off', async () => {
    delete process.env.BROKER_IQOPTION_REAL_ENABLED;
    const creds = new BrokerCredentialsService();
    const adapter = new IQOptionRealAdapter(creds);
    const ack = await adapter.sendOrder(baseRequest());
    expect(ack.status).toBe(BrokerOrderStatus.REJECT);
    expect(ack.reject_code).toBe('REAL_DISABLED');
    expect(ack.broker_order_id).toBe('REAL_DISABLED');
    // Must NOT attempt any network connection.
    expect(ack.latency_ms).toBe(0);
  });

  it('with flag on but no credentials, connectSession throws CREDENTIALS_MISSING (non-mock)', async () => {
    process.env.BROKER_IQOPTION_REAL_ENABLED = 'true';
    process.env.BROKER_MOCK_MODE = 'false';
    delete process.env.IQ_OPTION_SSID;
    const creds = new BrokerCredentialsService();
    const adapter = new IQOptionRealAdapter(creds);
    await expect(adapter.connectSession('ACC_1')).rejects.toThrow(
      /IQ_OPTION_CREDENTIALS_MISSING/,
    );
  });
});
