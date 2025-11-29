import { Injectable, Logger, Inject } from '@nestjs/common';
import { BROKER_ADAPTER, BrokerAdapterInterface } from '../adapters/broker-adapter.interface';
import { SessionManagerService } from './session-manager.service';
import { SessionHealth } from '../../shared/enums/session-health.enum';

@Injectable()
export class SessionHealthService {
  private readonly logger = new Logger(SessionHealthService.name);

  constructor(
    @Inject(BROKER_ADAPTER)
    private readonly brokerAdapter: BrokerAdapterInterface,
    private readonly sessionManager: SessionManagerService,
  ) {}

  async checkHealth(accountId: string): Promise<SessionHealth> {
    try {
      await this.brokerAdapter.getBalance(accountId);
      
      const current = this.sessionManager.getSessionHealth(accountId);
      
      if (current === SessionHealth.DOWN || current === SessionHealth.DEGRADED) {
        this.logger.log(`Session ${accountId} recovered to UP`);
        await this.sessionManager.ensureSession(accountId);
      }

      return SessionHealth.UP;
    } catch (error: any) {
      this.logger.warn(
        `Health check failed for ${accountId}: ${error?.message || String(error)}`,
      );

      await this.sessionManager.markDegraded(accountId);
      return SessionHealth.DEGRADED;
    }
  }
}
