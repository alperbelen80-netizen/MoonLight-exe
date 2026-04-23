import { Test } from '@nestjs/testing';
import { IQOptionRealAdapter } from '../../../broker/adapters/iq-option-real.adapter';
import { BinomoProtocolAdapter } from '../../../broker/adapters/binomo-protocol.adapter';
import { ExpertOptionHighFreqAdapter } from '../../../broker/adapters/expert-option-highfreq.adapter';
import { BrokerCredentialsService } from '../../../broker/adapters/broker-credentials.service';
import { MockWSServer } from '../../../broker/adapters/testing/mock-ws-server';
import { BrokerOrderStatus } from '../../../shared/dto/broker-order.dto';
import { SignalDirection } from '../../../shared/dto/canonical-signal.dto';
import { SessionHealth } from '../../../shared/enums/session-health.enum';

describe('WSS Broker Adapters (with MockWSServer)', () => {
  let server: MockWSServer;
  let port: number;

  beforeEach(async () => {
    server = new MockWSServer();
    port = await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  const baseRequest = (id = 'REQ_1') => ({
    broker_request_id: id,
    order_key: 'OK_1',
    symbol: 'EURUSD',
    direction: SignalDirection.CALL,
    stake_amount: 10,
    expiry_minutes: 5,
    art_id: 'ART_1',
    account_id: 'ACC_1',
    request_ts_utc: new Date().toISOString(),
  });

  describe('IQOptionRealAdapter', () => {
    it('accepts an order when MockWSServer returns isSuccessful=true', async () => {
      process.env.IQ_OPTION_WS_URL = `ws://127.0.0.1:${port}`;
      process.env.IQ_OPTION_SSID = 'TEST_SSID';
      process.env.IQ_OPTION_BALANCE_ID = '42';
      // V2.5-3: real adapter gated behind explicit opt-in flag.
      process.env.BROKER_IQOPTION_REAL_ENABLED = 'true';

      const moduleRef = await Test.createTestingModule({
        providers: [BrokerCredentialsService, IQOptionRealAdapter],
      }).compile();
      const adapter = moduleRef.get(IQOptionRealAdapter);

      server.setHandler((raw) => {
        const obj = JSON.parse(raw);
        if (obj.name === 'sendMessage' && obj.msg?.name === 'binary-options.open-option') {
          return {
            name: 'binary-options.open-option',
            request_id: obj.request_id,
            msg: { id: 'POS_123', isSuccessful: true, price: 1.2345 },
          };
        }
        return null;
      });

      await adapter.connectSession('ACC_1');
      expect(adapter.getSessionHealth()).toBe(SessionHealth.UP);

      const ack = await adapter.sendOrder(baseRequest());
      expect(ack.status).toBe(BrokerOrderStatus.ACK);
      expect(ack.broker_order_id).toBe('POS_123');
      expect(ack.open_price).toBe(1.2345);
      expect(ack.latency_ms).toBeGreaterThanOrEqual(0);

      await adapter.disconnectSession('ACC_1');
    });

    it('rejects order when credentials missing and not in mock mode', async () => {
      delete process.env.IQ_OPTION_SSID;
      delete process.env.IQ_OPTION_BALANCE_ID;
      delete process.env.BROKER_MOCK_MODE;
      // V2.5-3: enable the real adapter so this path exercises the
      // "configured-but-no-credentials" branch rather than the flag guard.
      process.env.BROKER_IQOPTION_REAL_ENABLED = 'true';

      const moduleRef = await Test.createTestingModule({
        providers: [BrokerCredentialsService, IQOptionRealAdapter],
      }).compile();
      const adapter = moduleRef.get(IQOptionRealAdapter);

      const ack = await adapter.sendOrder(baseRequest());
      expect(ack.status).toBe(BrokerOrderStatus.REJECT);
      expect(ack.reject_code).toBe('NOT_CONFIGURED');
    });

    it('returns TIMEOUT when server drops the response', async () => {
      process.env.IQ_OPTION_WS_URL = `ws://127.0.0.1:${port}`;
      process.env.IQ_OPTION_SSID = 'TEST_SSID';
      process.env.IQ_OPTION_BALANCE_ID = '42';
      process.env.BROKER_IQOPTION_REAL_ENABLED = 'true';

      const moduleRef = await Test.createTestingModule({
        providers: [BrokerCredentialsService, IQOptionRealAdapter],
      }).compile();
      const adapter = moduleRef.get(IQOptionRealAdapter);

      server.setHandler(() => null); // swallow all messages

      await adapter.connectSession('ACC_1');
      const start = Date.now();
      // Override the internal timeout by using a short env-driven flow: the
      // built-in adapter request timeout is 5000ms, but jest has 30s default.
      const ack = await adapter.sendOrder(baseRequest());
      expect(Date.now() - start).toBeGreaterThanOrEqual(4900);
      expect(ack.status).toBe(BrokerOrderStatus.TIMEOUT);
      expect(ack.reject_code).toBe('TIMEOUT');

      await adapter.disconnectSession('ACC_1');
    }, 10000);
  });

  describe('BinomoProtocolAdapter', () => {
    it('accepts an order when mock server returns success', async () => {
      process.env.BINOMO_WS_URL = `ws://127.0.0.1:${port}`;
      process.env.BINOMO_AUTH_TOKEN = 'TEST_TOKEN';
      process.env.BINOMO_DEVICE_ID = 'DEV_1';

      const moduleRef = await Test.createTestingModule({
        providers: [BrokerCredentialsService, BinomoProtocolAdapter],
      }).compile();
      const adapter = moduleRef.get(BinomoProtocolAdapter);

      server.setHandler((raw) => {
        const obj = JSON.parse(raw);
        if (obj.action === 'deals/open') {
          return {
            action: 'deals/open/response',
            request_id: obj.request_id,
            data: { status: 'success', deal_id: 'DEAL_AAA', open_price: 1.1 },
          };
        }
        return null;
      });

      await adapter.connectSession('ACC_1');
      const ack = await adapter.sendOrder(baseRequest('REQ_B1'));
      expect(ack.status).toBe(BrokerOrderStatus.ACK);
      expect(ack.broker_order_id).toBe('DEAL_AAA');
      expect(ack.open_price).toBe(1.1);
      await adapter.disconnectSession('ACC_1');
    });

    it('rejects with NOT_CONFIGURED when creds absent', async () => {
      delete process.env.BINOMO_AUTH_TOKEN;
      delete process.env.BROKER_MOCK_MODE;

      const moduleRef = await Test.createTestingModule({
        providers: [BrokerCredentialsService, BinomoProtocolAdapter],
      }).compile();
      const adapter = moduleRef.get(BinomoProtocolAdapter);

      const ack = await adapter.sendOrder(baseRequest('REQ_B2'));
      expect(ack.status).toBe(BrokerOrderStatus.REJECT);
      expect(ack.reject_code).toBe('NOT_CONFIGURED');
    });
  });

  describe('ExpertOptionHighFreqAdapter', () => {
    it('accepts order on happy path', async () => {
      process.env.EXPERT_OPTION_WS_URL = `ws://127.0.0.1:${port}`;
      process.env.EXPERT_OPTION_TOKEN = 'TEST_TOKEN';

      const moduleRef = await Test.createTestingModule({
        providers: [BrokerCredentialsService, ExpertOptionHighFreqAdapter],
      }).compile();
      const adapter = moduleRef.get(ExpertOptionHighFreqAdapter);

      server.setHandler((raw) => {
        const obj = JSON.parse(raw);
        if (obj.action === 'openOption') {
          return {
            action: 'openOption.result',
            reqId: obj.reqId,
            body: { success: true, position_id: 'EO_POS_1', open_price: 0.987 },
          };
        }
        return null;
      });

      await adapter.connectSession('ACC_1');
      const ack = await adapter.sendOrder(baseRequest('REQ_E1'));
      expect(ack.status).toBe(BrokerOrderStatus.ACK);
      expect(ack.broker_order_id).toBe('EO_POS_1');
      await adapter.disconnectSession('ACC_1');
    });

    it('REJECTS with BROKER_REJECT when server returns failure', async () => {
      process.env.EXPERT_OPTION_WS_URL = `ws://127.0.0.1:${port}`;
      process.env.EXPERT_OPTION_TOKEN = 'TEST_TOKEN';

      const moduleRef = await Test.createTestingModule({
        providers: [BrokerCredentialsService, ExpertOptionHighFreqAdapter],
      }).compile();
      const adapter = moduleRef.get(ExpertOptionHighFreqAdapter);

      server.setHandler((raw) => {
        const obj = JSON.parse(raw);
        if (obj.action === 'openOption') {
          return {
            action: 'openOption.result',
            reqId: obj.reqId,
            body: { success: false, reject_reason: 'INSUFFICIENT_BALANCE' },
          };
        }
        return null;
      });

      await adapter.connectSession('ACC_1');
      const ack = await adapter.sendOrder(baseRequest('REQ_E2'));
      expect(ack.status).toBe(BrokerOrderStatus.REJECT);
      expect(ack.reject_code).toBe('BROKER_REJECT');
      expect(ack.reject_message).toBe('INSUFFICIENT_BALANCE');
      await adapter.disconnectSession('ACC_1');
    });
  });
});
