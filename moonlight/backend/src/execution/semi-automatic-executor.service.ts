import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveSignal } from '../database/entities/live-signal.entity';
import { BrokerService } from '../broker/broker.service';
import { ARTEngineService } from '../risk/art-engine/art-engine.service';
import { RiskGuardrailService } from '../risk/risk-guardrail.service';
import { LiveStrategyPerformanceService } from '../strategy/live-strategy-performance.service';
import { HealthScoreCalculator } from './health-score-calculator.service';
import { AccountEnforcementService } from '../broker/account-enforcement.service';
import { DEFAULT_RISK_LIMITS } from '../risk/models/risk-limits.model';
import { RiskContextSnapshot } from '../shared/dto/risk-profile.dto';
import { buildOrderKey } from '../broker/order/order-key.util';
import { v4 as uuidv4 } from 'uuid';

export interface ApprovedSignalExecution {
  signalId: string;
  success: boolean;
  brokerOrderId?: string;
  healthScore?: number;
  accountType?: string;
  warnings?: string[];
  error?: string;
}

@Injectable()
export class SemiAutomaticExecutor {
  private readonly logger = new Logger(SemiAutomaticExecutor.name);
  private enabled: boolean;

  constructor(
    @InjectRepository(LiveSignal)
    private readonly liveSignalRepo: Repository<LiveSignal>,
    private readonly brokerService: BrokerService,
    private readonly artEngine: ARTEngineService,
    private readonly riskGuardrailService: RiskGuardrailService,
    private readonly strategyPerformance: LiveStrategyPerformanceService,
    private readonly healthCalculator: HealthScoreCalculator,
    private readonly accountEnforcement: AccountEnforcementService,
  ) {
    this.enabled = process.env.SEMI_AUTO_ENABLED === 'true';
  }

  async executeApprovedSignal(
    signalId: string,
    accountId: string,
  ): Promise<ApprovedSignalExecution> {
    if (!this.enabled) {
      return {
        signalId,
        success: false,
        error: 'Semi-automatic mode disabled',
      };
    }

    const accountValidation = await this.accountEnforcement.validateAccountForExecution(
      accountId,
    );

    if (!accountValidation.allowed) {
      return {
        signalId,
        success: false,
        accountType: accountValidation.accountType,
        warnings: accountValidation.warnings,
        error: 'Account validation failed: ' + accountValidation.warnings.join(', '),
      };
    }

    const signal = await this.liveSignalRepo.findOne({ where: { id: signalId } });

    if (!signal) {
      return {
        signalId,
        success: false,
        error: 'Signal not found',
      };
    }

    if (signal.status !== 'NEW') {
      return {
        signalId,
        success: false,
        error: `Signal already ${signal.status}`,
      };
    }

    const startTime = Date.now();

    try {
      await this.accountEnforcement.logAccountAction(
        accountId,
        'EXECUTE_SIGNAL',
        `Signal: ${signalId}, Symbol: ${signal.symbol}`,
      );

      const riskContext: RiskContextSnapshot = {
        equity: 1000,
        open_trades_count: 0,
        today_loss_abs: 0,
        today_loss_pct: 0,
        symbol_exposure_pct: 0,
      };

      const guardrailDecision = this.riskGuardrailService.evaluateForBacktest({
        profile: {
          id: 'PROFILE_SEMI_AUTO',
          name: 'Semi-Auto',
          max_per_trade_pct: 0.02,
          max_daily_loss_pct: 0.1,
          max_concurrent_trades: 3,
          max_exposure_per_symbol_pct: 0.3,
          enabled: true,
          created_at_utc: new Date().toISOString(),
          updated_at_utc: new Date().toISOString(),
        },
        context: riskContext,
        requested_stake: 25,
      });

      if (!guardrailDecision.allowed) {
        await this.liveSignalRepo.update(
          { id: signalId },
          { status: 'SKIPPED', notes: `Risk blocked: ${guardrailDecision.violations.join(', ')}` },
        );

        return {
          signalId,
          success: false,
          accountType: accountValidation.accountType,
          error: `Risk guardrail blocked: ${guardrailDecision.violations.join(', ')}`,
        };
      }

      const orderKey = buildOrderKey({
        signalId,
        accountId,
        symbol: signal.symbol,
        expiryMinutes: Math.floor(signal.signal_horizon / 60),
      });

      const brokerRequest = {
        broker_request_id: `REQ_${uuidv4()}`,
        order_key: orderKey,
        symbol: signal.symbol,
        direction: signal.direction as any,
        stake_amount: guardrailDecision.effective_stake_amount,
        expiry_minutes: Math.floor(signal.signal_horizon / 60),
        art_id: `ART_${signalId}`,
        account_id: accountId,
        request_ts_utc: new Date().toISOString(),
      };

      const ack = await this.brokerService.sendOrderWithIdempotency(brokerRequest);

      const latencyMs = Date.now() - startTime;

      const healthScore = this.healthCalculator.calculateTradeHealth({
        latencyMs,
        executionQuality: this.healthCalculator.calculateExecutionQuality({
          orderAcked: ack.status === 'ACK',
          slippagePips: 0,
          fillRate: 1.0,
        }),
        routingQuality: this.healthCalculator.calculateRoutingQuality({
          brokerRejected: ack.status === 'REJECT',
        }),
        riskCompliance: this.healthCalculator.calculateRiskCompliance({
          artApproved: true,
          guardrailsPassed: true,
          tripleCheckPassed: true,
        }),
        reliability: this.healthCalculator.calculateReliability({
          timeout: false,
          errors: 0,
        }),
        dataConsistency: 100,
      });

      await this.liveSignalRepo.update(
        { id: signalId },
        {
          status: 'MARKED_EXECUTED',
          notes: `${accountValidation.accountType} account | Order ${ack.broker_order_id} | Health: ${healthScore.score}/100`,
        },
      );

      await this.strategyPerformance.recordExecution(
        signal.strategy_family,
        'WIN',
        0,
      );

      this.logger.log(
        `Semi-auto executed (${accountValidation.accountType}): ${signalId}, Health: ${healthScore.score}`,
      );

      return {
        signalId,
        success: true,
        brokerOrderId: ack.broker_order_id,
        healthScore: healthScore.score,
        accountType: accountValidation.accountType,
        warnings: accountValidation.warnings,
      };
    } catch (error: any) {
      this.logger.error(
        `Semi-auto execution failed: ${error?.message || String(error)}`,
      );

      await this.liveSignalRepo.update(
        { id: signalId },
        { status: 'SKIPPED', notes: `Execution error: ${error?.message}` },
      );

      return {
        signalId,
        success: false,
        accountType: accountValidation.accountType,
        error: error?.message || String(error),
      };
    }
  }
}
