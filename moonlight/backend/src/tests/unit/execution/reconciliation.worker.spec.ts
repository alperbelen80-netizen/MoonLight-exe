import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationWorker } from '../../../execution/reconciliation/reconciliation.worker';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReconciliationRun } from '../../../database/entities/reconciliation-run.entity';
import { BROKER_ADAPTER } from '../../../broker/adapters/broker-adapter.interface';
import { BrokerPositionStatus } from '../../../shared/dto/broker-position.dto';

const mockRepo = {
  create: jest.fn((entity) => entity),
  save: jest.fn((entity) => Promise.resolve(entity)),
  update: jest.fn(),
};

const mockBrokerAdapter = {
  getOpenPositions: jest.fn().mockResolvedValue([
    {
      position_id: 'POS_BROKER_001',
      symbol: 'XAUUSD',
      direction: 'CALL',
      stake_amount: 25,
      entry_price: 2035.5,
      open_ts_utc: new Date().toISOString(),
      expiry_ts_utc: new Date(Date.now() + 300000).toISOString(),
      status: BrokerPositionStatus.OPEN,
    },
  ]),
};

describe('ReconciliationWorker', () => {
  let worker: ReconciliationWorker;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationWorker,
        {
          provide: getRepositoryToken(ReconciliationRun),
          useValue: mockRepo,
        },
        {
          provide: BROKER_ADAPTER,
          useValue: mockBrokerAdapter,
        },
      ],
    }).compile();

    worker = module.get<ReconciliationWorker>(ReconciliationWorker);
    jest.clearAllMocks();
  });

  it('should detect missing internal positions', async () => {
    const result = await worker.runReconciliation('ACC_001');

    expect(result.missing_internal.length).toBeGreaterThan(0);
    expect(result.missing_internal[0].symbol).toBe('XAUUSD');
    expect(result.missing_internal[0].reason).toContain('Position in broker but not in internal');
  });

  it('should create reconciliation run record', async () => {
    await worker.runReconciliation('ACC_002');

    expect(mockRepo.save).toHaveBeenCalled();
    expect(mockRepo.update).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ status: 'COMPLETED' }),
    );
  });
});
