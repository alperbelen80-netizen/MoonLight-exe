import { Test } from '@nestjs/testing';
import { OlympTradePGSAdapter } from '../../../broker/adapters/olymp-trade-pgs.adapter';
import { BrokerCredentialsService } from '../../../broker/adapters/broker-credentials.service';
import { BrokerOrderStatus } from '../../../shared/dto/broker-order.dto';
import { SignalDirection } from '../../../shared/dto/canonical-signal.dto';

describe('OlympTradePGSAdapter', () => {
  const baseRequest = {
    broker_request_id: 'REQ_O1',
    order_key: 'OK_1',
    symbol: 'EURUSD',
    direction: SignalDirection.CALL,
    stake_amount: 10,
    expiry_minutes: 5,
    art_id: 'ART_1',
    account_id: 'ACC_1',
    request_ts_utc: new Date().toISOString(),
  };

  it('returns NOT_CONFIGURED when creds absent and not in mock mode', async () => {
    delete process.env.OLYMP_TRADE_EMAIL;
    delete process.env.OLYMP_TRADE_PASSWORD;
    delete process.env.BROKER_MOCK_MODE;

    const moduleRef = await Test.createTestingModule({
      providers: [BrokerCredentialsService, OlympTradePGSAdapter],
    }).compile();
    const adapter = moduleRef.get(OlympTradePGSAdapter);

    const ack = await adapter.sendOrder(baseRequest);
    expect(ack.status).toBe(BrokerOrderStatus.REJECT);
    expect(ack.reject_code).toBe('NOT_CONFIGURED');
  });

  it('throws OLYMP_TRADE_CREDENTIALS_MISSING on connectSession without creds', async () => {
    delete process.env.OLYMP_TRADE_EMAIL;
    delete process.env.OLYMP_TRADE_PASSWORD;
    delete process.env.BROKER_MOCK_MODE;

    const moduleRef = await Test.createTestingModule({
      providers: [BrokerCredentialsService, OlympTradePGSAdapter],
    }).compile();
    const adapter = moduleRef.get(OlympTradePGSAdapter);

    await expect(adapter.connectSession('ACC_1')).rejects.toThrow(
      'OLYMP_TRADE_CREDENTIALS_MISSING',
    );
  });

  it('reports getBrokerId and initial health correctly', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [BrokerCredentialsService, OlympTradePGSAdapter],
    }).compile();
    const adapter = moduleRef.get(OlympTradePGSAdapter);

    expect(adapter.getBrokerId()).toBe('OLYMP_TRADE');
    expect(['DOWN', 'RECONNECTING']).toContain(adapter.getSessionHealth());
  });
});
