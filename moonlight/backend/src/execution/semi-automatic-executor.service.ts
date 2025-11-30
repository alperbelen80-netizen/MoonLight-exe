import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LiveSignal } from '../database/entities/live-signal.entity';
import { BrokerService } from '../broker/broker.service';
import { ARTEngineService } from '../risk/art-engine/art-engine.service';
import { RiskGuardrailService } from '../risk/risk-guardrail.service';
import { DEFAULT_RISK_LIMITS } from '../risk/models/risk-limits.model';
import { RiskContextSnapshot } from '../shared/dto/risk-profile.dto';
import { buildOrderKey } from '../broker/order/order-key.util';
import { v4 as uuidv4 } from 'uuid';

export interface ApprovedSignalExecution {
  signalId: string;
  success: boolean;
  brokerOrderId?: string;
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

    try {
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

      await this.liveSignalRepo.update(
        { id: signalId },
        {
          status: 'MARKED_EXECUTED',
          notes: `Auto-executed: Order ${ack.broker_order_id}`,
        },
      );

      this.logger.log(
        `Semi-auto executed signal ${signalId}: Order ${ack.broker_order_id}`,
      );

      return {
        signalId,
        success: true,
        brokerOrderId: ack.broker_order_id,
      };
    } catch (error: any) {
      this.logger.error(
        `Semi-auto execution failed for ${signalId}: ${error?.message || String(error)}`,
      );

      await this.liveSignalRepo.update(
        { id: signalId },
        { status: 'SKIPPED', notes: `Execution error: ${error?.message}` },
      );

      return {
        signalId,
        success: false,
        error: error?.message || String(error),
      };
    }
  }
}
