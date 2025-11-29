import { Controller, Get, Param } from '@nestjs/common';
import { ReconciliationWorker } from './reconciliation.worker';
import { ReconciliationResultDTO } from '../../shared/dto/reconciliation.dto';

@Controller('exec/reconciliation')
export class ReconciliationController {
  constructor(private readonly reconciliationWorker: ReconciliationWorker) {}

  @Get(':accountId/run')
  async runReconciliation(
    @Param('accountId') accountId: string,
  ): Promise<ReconciliationResultDTO> {
    return this.reconciliationWorker.runReconciliation(accountId);
  }
}
