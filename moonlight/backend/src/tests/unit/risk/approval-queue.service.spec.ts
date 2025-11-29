import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalQueueService } from '../../../risk/approval-queue.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApprovalQueue } from '../../../database/entities/approval-queue.entity';

const mockRepo = {
  create: jest.fn((entity) => entity),
  save: jest.fn((entity) => Promise.resolve(entity)),
  update: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
};

describe('ApprovalQueueService', () => {
  let service: ApprovalQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalQueueService,
        {
          provide: getRepositoryToken(ApprovalQueue),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<ApprovalQueueService>(ApprovalQueueService);
    jest.clearAllMocks();
  });

  it('should enqueue trade for approval', async () => {
    await service.enqueue({
      tradeUid: 'TRD_001',
      signalId: 'SIG_001',
      accountId: 'ACC_001',
      uncertaintyScore: 0.7,
      uncertaintyLevel: 'HIGH',
    });

    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        trade_uid: 'TRD_001',
        status: 'PENDING',
        m3_uncertainty_score: 0.7,
      }),
    );
  });

  it('should approve queued item', async () => {
    await service.approve('APPROVAL_123', 'owner@test.com');

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: 'APPROVAL_123' },
      expect.objectContaining({
        status: 'APPROVED',
        decided_by: 'owner@test.com',
      }),
    );
  });

  it('should reject queued item', async () => {
    await service.reject('APPROVAL_456', 'owner@test.com');

    expect(mockRepo.update).toHaveBeenCalledWith(
      { id: 'APPROVAL_456' },
      expect.objectContaining({
        status: 'REJECTED',
        decided_by: 'owner@test.com',
      }),
    );
  });
});
