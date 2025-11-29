import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ApprovalQueue } from '../database/entities/approval-queue.entity';

export interface ApprovalQueueItemDTO {
  id: string;
  trade_uid: string;
  signal_id: string;
  account_id: string;
  status: string;
  m3_uncertainty_score: number;
  m3_uncertainty_level: string;
  created_at_utc: string;
}

@Injectable()
export class ApprovalQueueService {
  private readonly logger = new Logger(ApprovalQueueService.name);

  constructor(
    @InjectRepository(ApprovalQueue)
    private readonly queueRepo: Repository<ApprovalQueue>,
  ) {}

  async enqueue(params: {
    tradeUid: string;
    signalId: string;
    accountId: string;
    uncertaintyScore: number;
    uncertaintyLevel: string;
  }): Promise<void> {
    const item = this.queueRepo.create({
      id: `APPROVAL_${uuidv4()}`,
      trade_uid: params.tradeUid,
      signal_id: params.signalId,
      account_id: params.accountId,
      status: 'PENDING',
      m3_uncertainty_score: params.uncertaintyScore,
      m3_uncertainty_level: params.uncertaintyLevel,
      created_at_utc: new Date(),
    });

    await this.queueRepo.save(item);

    this.logger.log(
      `Trade ${params.tradeUid} added to approval queue (uncertainty: ${params.uncertaintyLevel})`,
    );
  }

  async approve(id: string, decidedBy: string): Promise<void> {
    await this.queueRepo.update(
      { id },
      {
        status: 'APPROVED',
        decided_at_utc: new Date(),
        decided_by: decidedBy,
      },
    );

    this.logger.log(`Approval ${id} APPROVED by ${decidedBy}`);
  }

  async reject(id: string, decidedBy: string): Promise<void> {
    await this.queueRepo.update(
      { id },
      {
        status: 'REJECTED',
        decided_at_utc: new Date(),
        decided_by: decidedBy,
      },
    );

    this.logger.log(`Approval ${id} REJECTED by ${decidedBy}`);
  }

  async listPending(limit: number): Promise<ApprovalQueueItemDTO[]> {
    const items = await this.queueRepo.find({
      where: { status: 'PENDING' },
      order: { created_at_utc: 'DESC' },
      take: limit,
    });

    return items.map((i) => ({
      id: i.id,
      trade_uid: i.trade_uid,
      signal_id: i.signal_id,
      account_id: i.account_id,
      status: i.status,
      m3_uncertainty_score: i.m3_uncertainty_score,
      m3_uncertainty_level: i.m3_uncertainty_level,
      created_at_utc: i.created_at_utc.toISOString(),
    }));
  }
}
