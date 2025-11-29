import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionConfig } from '../database/entities/execution-config.entity';
import { ProductExecutionConfig } from '../database/entities/product-execution-config.entity';
import { OwnerAccount } from '../database/entities/owner-account.entity';
import { ExecutionMode } from '../shared/enums/execution-mode.enum';
import { ExecutionModeDTO } from '../shared/dto/execution-mode.dto';
import { ProductExecutionConfigDTO } from '../shared/dto/product-execution-config.dto';
import { OwnerAccountDTO } from '../shared/dto/owner-account.dto';
import { OwnerDashboardSummaryDTO, HealthColor } from '../shared/dto/owner-dashboard-summary.dto';
import { SessionManagerService } from '../broker/session/session-manager.service';
import { ApprovalQueueService } from '../risk/approval-queue.service';
import { CircuitBreakerService } from '../risk/fail-safe/circuit-breaker.service';

@Injectable()
export class OwnerService {
  private readonly logger = new Logger(OwnerService.name);

  constructor(
    @InjectRepository(ExecutionConfig)
    private readonly execConfigRepo: Repository<ExecutionConfig>,
    @InjectRepository(ProductExecutionConfig)
    private readonly productConfigRepo: Repository<ProductExecutionConfig>,
    @InjectRepository(OwnerAccount)
    private readonly accountRepo: Repository<OwnerAccount>,
    private readonly sessionManager: SessionManagerService,
    private readonly approvalQueueService: ApprovalQueueService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  async getDashboardSummary(): Promise<OwnerDashboardSummaryDTO> {
    const execMode = await this.getExecutionMode();

    const pendingApprovals = await this.approvalQueueService.listPending(100);

    const globalHealthScore = 85;
    const globalHealthColor = HealthColor.GREEN;

    const dailyNetPnl = 0;
    const dailyTradeCount = 0;
    const monthlyNetPnl = 0;
    const liveWinRate7d = 0.65;
    const liveTradeCount7d = 0;

    return {
      global_health_score: globalHealthScore,
      global_health_color: globalHealthColor,
      daily_net_pnl: dailyNetPnl,
      daily_trade_count: dailyTradeCount,
      monthly_net_pnl: monthlyNetPnl,
      live_win_rate_7d: liveWinRate7d,
      live_trade_count_7d: liveTradeCount7d,
      execution_mode: execMode.mode,
      circuit_breaker_level: 'NONE',
      approval_queue_pending_count: pendingApprovals.length,
      fail_safe_active: false,
      top_strategies: [],
      top_symbols: [],
      generated_at_utc: new Date().toISOString(),
    };
  }

  async getAccounts(): Promise<OwnerAccountDTO[]> {
    const accounts = await this.accountRepo.find();

    return accounts.map((a) => ({
      account_id: a.account_id,
      broker_id: a.broker_id,
      alias: a.alias,
      type: a.type,
      status: a.status,
      session_health: a.session_health as any,
      balance: a.balance,
      created_at_utc: a.created_at_utc.toISOString(),
    }));
  }

  async getProductExecutionMatrix(): Promise<ProductExecutionConfigDTO[]> {
    const configs = await this.productConfigRepo.find();

    return configs.map((c) => ({
      id: c.id,
      symbol: c.symbol,
      tf: c.tf,
      data_enabled: c.data_enabled,
      signal_enabled: c.signal_enabled,
      auto_trade_enabled: c.auto_trade_enabled,
      updated_at_utc: c.updated_at_utc.toISOString(),
    }));
  }

  async updateProductExecutionConfig(
    id: string,
    patch: Partial<ProductExecutionConfigDTO>,
  ): Promise<ProductExecutionConfigDTO> {
    await this.productConfigRepo.update({ id }, {
      data_enabled: patch.data_enabled,
      signal_enabled: patch.signal_enabled,
      auto_trade_enabled: patch.auto_trade_enabled,
      updated_at_utc: new Date(),
    });

    const updated = await this.productConfigRepo.findOne({ where: { id } });

    if (!updated) {
      throw new Error(`ProductExecutionConfig ${id} not found`);
    }

    return {
      id: updated.id,
      symbol: updated.symbol,
      tf: updated.tf,
      data_enabled: updated.data_enabled,
      signal_enabled: updated.signal_enabled,
      auto_trade_enabled: updated.auto_trade_enabled,
      updated_at_utc: updated.updated_at_utc.toISOString(),
    };
  }

  async getExecutionMode(): Promise<ExecutionModeDTO> {
    const config = await this.execConfigRepo.findOne({ where: { id: 'GLOBAL' } });

    if (!config) {
      const defaultConfig = this.execConfigRepo.create({
        id: 'GLOBAL',
        mode: ExecutionMode.OFF,
        updated_at_utc: new Date(),
      });

      await this.execConfigRepo.save(defaultConfig);

      return {
        mode: ExecutionMode.OFF,
        updated_at_utc: defaultConfig.updated_at_utc.toISOString(),
      };
    }

    return {
      mode: config.mode as ExecutionMode,
      updated_at_utc: config.updated_at_utc.toISOString(),
    };
  }

  async setExecutionMode(mode: ExecutionMode): Promise<ExecutionModeDTO> {
    const config = await this.execConfigRepo.findOne({ where: { id: 'GLOBAL' } });

    if (!config) {
      const newConfig = this.execConfigRepo.create({
        id: 'GLOBAL',
        mode,
        updated_at_utc: new Date(),
      });

      await this.execConfigRepo.save(newConfig);

      this.logger.log(`Execution mode set to: ${mode}`);

      return {
        mode,
        updated_at_utc: newConfig.updated_at_utc.toISOString(),
      };
    }

    await this.execConfigRepo.update(
      { id: 'GLOBAL' },
      { mode, updated_at_utc: new Date() },
    );

    this.logger.log(`Execution mode changed to: ${mode}`);

    const updated = await this.execConfigRepo.findOne({ where: { id: 'GLOBAL' } });

    return {
      mode: updated!.mode as ExecutionMode,
      updated_at_utc: updated!.updated_at_utc.toISOString(),
    };
  }

  async createAccount(params: {
    alias: string;
    brokerId: string;
    type: string;
  }): Promise<OwnerAccountDTO> {
    const account = this.accountRepo.create({
      account_id: `ACC_${uuidv4()}`,
      alias: params.alias,
      broker_id: params.brokerId,
      type: params.type,
      status: 'ACTIVE',
      session_health: 'UP',
      created_at_utc: new Date(),
    });

    await this.accountRepo.save(account);

    this.logger.log(`Account created: ${account.account_id}`);

    return {
      account_id: account.account_id,
      broker_id: account.broker_id,
      alias: account.alias,
      type: account.type,
      status: account.status,
      session_health: account.session_health as any,
      balance: account.balance,
      created_at_utc: account.created_at_utc.toISOString(),
    };
  }
}
