import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionFSM, ExecutionContext } from './state-machine/execution-fsm';
import { ExecutionRequestDTO, ExecutionStartResultDTO } from '../shared/dto/execution-request.dto';
import { ExecutionState } from '../shared/enums/execution-state.enum';
import { ARTEngineService } from '../risk/art-engine/art-engine.service';
import { RiskProfileService } from '../risk/risk-profile.service';
import { RiskGuardrailService } from '../risk/risk-guardrail.service';
import { TripleCheckService } from '../risk/triple-check/triple-check.service';
import { M3DefensiveService } from '../risk/m3-defensive.service';
import { ApprovalQueueService } from '../risk/approval-queue.service';
import { CircuitBreakerService } from '../risk/fail-safe/circuit-breaker.service';
import { BrokerService } from '../broker/broker.service';
import { buildOrderKey } from '../broker/order/order-key.util';
import { M3Mode, M3FinalAction } from '../shared/dto/m3-decision.dto';
import { RiskContextSnapshot } from '../shared/dto/risk-profile.dto';
import { DEFAULT_RISK_LIMITS } from '../risk/models/risk-limits.model';

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly fsm: ExecutionFSM,
    private readonly artEngine: ARTEngineService,
    private readonly riskProfileService: RiskProfileService,
    private readonly riskGuardrailService: RiskGuardrailService,
    private readonly tripleCheckService: TripleCheckService,
    private readonly m3DefensiveService: M3DefensiveService,
    private readonly approvalQueueService: ApprovalQueueService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly brokerService: BrokerService,
  ) {}

  async startExecution(
    request: ExecutionRequestDTO,
  ): Promise<ExecutionStartResultDTO> {
    const { signal, environment, account_id, requested_stake } = request;

    const tradeUid = `TRD_${uuidv4()}`;

    if (this.circuitBreakerService.isBlocked(account_id)) {
      this.logger.warn(
        `Trade ${tradeUid} blocked: Circuit Breaker active for ${account_id}`,
      );

      return {
        trade_uid: tradeUid,
        current_state: ExecutionState.CANCELLED,
      };
    }

    let context: ExecutionContext = {
      trade_uid: tradeUid,
      signal_id: signal.signal_id,
      current_state: ExecutionState.SIGNAL_CREATED,
      metadata: {
        signal,
        environment,
        account_id,
      },
    };

    const tripleCheckResult = this.tripleCheckService.evaluate({
      data_quality: undefined,
    });

    const m3Decision = this.m3DefensiveService.decide({
      mode: M3Mode.AUTO,
      tripleCheck: tripleCheckResult,
    });

    if (m3Decision.final_action === M3FinalAction.ABSTAIN) {
      this.logger.log(`Trade ${tradeUid} abstained by M3 (uncertainty: ${m3Decision.uncertainty_level})`);

      return {
        trade_uid: tradeUid,
        current_state: ExecutionState.CANCELLED,
        m3_decision: m3Decision,
      };
    }

    if (m3Decision.final_action === M3FinalAction.HUMAN_APPROVAL) {
      this.logger.log(`Trade ${tradeUid} requires human approval`);

      await this.approvalQueueService.enqueue({
        tradeUid,
        signalId: signal.signal_id,
        accountId: account_id,
        uncertaintyScore: m3Decision.uncertainty_score,
        uncertaintyLevel: m3Decision.uncertainty_level,
      });

      return {
        trade_uid: tradeUid,
        current_state: 'WAITING_HUMAN' as any,
        m3_decision: m3Decision,
        human_approval_required: true,
      };
    }

    const riskContext: RiskContextSnapshot = {
      equity: 1000,
      open_trades_count: 0,
      today_loss_abs: 0,
      today_loss_pct: 0,
      symbol_exposure_pct: 0,
    };

    const guardrailDecision = this.riskGuardrailService.evaluateForBacktest({
      profile: {
        id: 'PROFILE_DEFAULT',
        name: 'Default',
        max_per_trade_pct: 0.02,
        max_daily_loss_pct: 0.1,
        max_concurrent_trades: 5,
        max_exposure_per_symbol_pct: 0.3,
        enabled: true,
        created_at_utc: new Date().toISOString(),
        updated_at_utc: new Date().toISOString(),
      },
      context: riskContext,
      requested_stake: requested_stake || 25,
    });

    if (!guardrailDecision.allowed) {
      this.logger.warn(
        `Trade ${tradeUid} blocked by guardrail: ${guardrailDecision.violations.join(', ')}`,
      );

      context.metadata.guardrail_violations = guardrailDecision.violations;

      return {
        trade_uid: tradeUid,
        current_state: ExecutionState.CANCELLED,
      };
    }

    const art = await this.artEngine.requestART(signal, DEFAULT_RISK_LIMITS, {
      user_id: 'USER_DEFAULT',
      account_id,
      profile_id: request.risk_profile_id || 'PROFILE_DEFAULT',
    });

    if (art.decision !== 'ACCEPT') {
      this.logger.warn(`Trade ${tradeUid} rejected by ART: ${art.decision}`);

      context.metadata.art_decision = art.decision;

      const resultFsm = await this.fsm.transition({
        ...context,
        current_state: ExecutionState.RISK_CHECKED,
      });

      return {
        trade_uid: tradeUid,
        current_state: resultFsm.next_state,
        art_decision: art,
      };
    }

    context.metadata.art_decision = 'ACCEPT';
    context.metadata.art_id = art.art_id;

    const orderKey = buildOrderKey({
      signalId: signal.signal_id,
      accountId: account_id,
      symbol: signal.symbol,
      expiryMinutes: 5,
    });

    const brokerRequest = {
      broker_request_id: `REQ_${uuidv4()}`,
      order_key: orderKey,
      symbol: signal.symbol,
      direction: signal.direction,
      stake_amount: guardrailDecision.effective_stake_amount,
      expiry_minutes: 5,
      art_id: art.art_id,
      account_id,
      request_ts_utc: new Date().toISOString(),
    };

    const ack = await this.brokerService.sendOrderWithIdempotency(brokerRequest);

    context.metadata.broker_response = ack;

    const finalFsm = await this.fsm.transition({
      ...context,
      current_state: ExecutionState.ORDER_SENT,
    });

    this.logger.log(
      `Trade ${tradeUid} executed: state=${finalFsm.next_state}, broker_order_id=${ack.broker_order_id}`,
    );

    return {
      trade_uid: tradeUid,
      current_state: finalFsm.next_state,
      art_decision: art,
      m3_decision: m3Decision,
    };
  }
}
