import { Test, TestingModule } from '@nestjs/testing';
import { IdempotentOrderService } from '../../../broker/order/idempotent-order.service';
import { FakeBrokerAdapter } from '../../../broker/adapters/fake-broker.adapter';
import { BROKER_ADAPTER } from '../../../broker/adapters/broker-adapter.interface';
import { BrokerOrderRequestDTO, BrokerOrderStatus } from '../../../shared/dto/broker-order.dto';
import { SignalDirection } from '../../../shared/dto/canonical-signal.dto';
import { buildOrderKey } from '../../../broker/order/order-key.util';

describe('IdempotentOrderService', () => {
  let service: IdempotentOrderService;
  let fakeBroker: FakeBrokerAdapter;

  beforeEach(async () => {
    fakeBroker = new FakeBrokerAdapter();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotentOrderService,
        {
          provide: BROKER_ADAPTER,
          useValue: fakeBroker,
        },
      ],
    }).compile();

    service = module.get<IdempotentOrderService>(IdempotentOrderService);
    service.clearCache();
    fakeBroker.setShouldFail(false);
  });

  const createMockRequest = (): BrokerOrderRequestDTO => ({
    broker_request_id: 'REQ_001',
    order_key: buildOrderKey({
      signalId: 'SIG_001',
      accountId: 'ACC_001',
      symbol: 'XAUUSD',
      expiryMinutes: 5,
    }),
    symbol: 'XAUUSD',
    direction: SignalDirection.CALL,
    stake_amount: 25,
    expiry_minutes: 5,
    art_id: 'ART_001',
    account_id: 'ACC_001',
    request_ts_utc: new Date().toISOString(),
  });

  it('should send order and cache result', async () => {
    const request = createMockRequest();

    const ack = await service.sendOrderIdempotent(request);

    expect(ack.status).toBe(BrokerOrderStatus.ACK);
    expect(ack.broker_order_id).toBeDefined();
    expect(service.getCacheSize()).toBe(1);
  });

  it('should return cached result for duplicate order_key', async () => {
    const request = createMockRequest();

    const ack1 = await service.sendOrderIdempotent(request);
    const ack2 = await service.sendOrderIdempotent(request);

    expect(ack1.broker_order_id).toBe(ack2.broker_order_id);
    expect(service.getCacheSize()).toBe(1);
  });

  it('should retry on failure and succeed on second attempt', async () => {
    const request = createMockRequest();

    fakeBroker.setFailOnce();

    const ack = await service.sendOrderIdempotent(request, { maxAttempts: 3 });

    expect(ack.status).toBe(BrokerOrderStatus.ACK);
  });

  it('should throw error when all retry attempts fail', async () => {
    const request = createMockRequest();

    fakeBroker.setShouldFail(true);

    await expect(
      service.sendOrderIdempotent(request, { maxAttempts: 2 }),
    ).rejects.toThrow('FakeBroker simulated failure');
  });

  it('should respect maxAttempts=1 and fail immediately', async () => {
    const request = createMockRequest();

    fakeBroker.setShouldFail(true);

    await expect(
      service.sendOrderIdempotent(request, { maxAttempts: 1 }),
    ).rejects.toThrow();
  });
});
