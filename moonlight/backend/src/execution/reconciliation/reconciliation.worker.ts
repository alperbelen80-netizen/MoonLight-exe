import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ReconciliationRun } from '../../database/entities/reconciliation-run.entity';
import { ReconciliationResultDTO, MismatchDTO } from '../../shared/dto/reconciliation.dto';
import { BROKER_ADAPTER, BrokerAdapterInterface } from '../../broker/adapters/broker-adapter.interface';

@Injectable()
export class ReconciliationWorker {
  private readonly logger = new Logger(ReconciliationWorker.name);

  constructor(
    @InjectRepository(ReconciliationRun)
    private readonly reconRunRepo: Repository<ReconciliationRun>,
    @Inject(BROKER_ADAPTER)
    private readonly brokerAdapter: BrokerAdapterInterface,
  ) {}

  async runReconciliation(accountId: string): Promise<ReconciliationResultDTO> {
    const runId = `RECON_${uuidv4()}`;

    const run = this.reconRunRepo.create({
      id: runId,
      account_id: accountId,
      status: 'RUNNING',
      mismatch_count: 0,
      created_at_utc: new Date(),
    });

    await this.reconRunRepo.save(run);

    const brokerPositions = await this.brokerAdapter.getOpenPositions(accountId);

    const internalPositions: any[] = [];

    const mismatchedPositions: MismatchDTO[] = [];
    const missingInternal: MismatchDTO[] = [];
    const missingBroker: MismatchDTO[] = [];

    brokerPositions.forEach((bPos) => {
      const found = internalPositions.find(
        (iPos) => iPos.position_id === bPos.position_id,
      );

      if (!found) {
        missingInternal.push({
          id: bPos.position_id,
          symbol: bPos.symbol,
          actual: bPos,
          reason: 'Position in broker but not in internal records',
        });
      }
    });

    const totalMismatches =
      mismatchedPositions.length + missingInternal.length + missingBroker.length;

    await this.reconRunRepo.update(
      { id: runId },
      {
        status: 'COMPLETED',
        mismatch_count: totalMismatches,
        completed_at_utc: new Date(),
      },
    );

    this.logger.log(
      `Reconciliation ${runId} for ${accountId}: ${totalMismatches} mismatches`,
    );

    return {
      run_id: runId,
      account_id: accountId,
      mismatched_positions: mismatchedPositions,
      missing_internal: missingInternal,
      missing_broker: missingBroker,
      checked_at_utc: new Date().toISOString(),
    };
  }
}
