import { Injectable, Logger } from '@nestjs/common';
import {
  ConflictCheckRequest,
  ConflictCheckResult,
  ConflictDecision,
  OpenTradeDTO,
} from '../../shared/dto/conflict-check.dto';
import { RiskLimitsConfig } from '../../risk/models/risk-limits.model';

const SYMBOL_TO_CLUSTER: Record<string, string> = {
  XAUUSD: 'METAL',
  XAGUSD: 'METAL',
  EURUSD: 'FX_MAJOR',
  GBPUSD: 'FX_MAJOR',
  USDJPY: 'FX_MAJOR',
  BTCUSD: 'CRYPTO',
  ETHUSD: 'CRYPTO',
};

@Injectable()
export class ConflictResolverService {
  private readonly logger = new Logger(ConflictResolverService.name);

  async checkConflict(
    request: ConflictCheckRequest,
    limits: RiskLimitsConfig,
  ): Promise<ConflictCheckResult> {
    const { new_signal, open_trades, scheduled_trades } = request;
    const reason_codes: string[] = [];

    const allTrades = [...open_trades, ...scheduled_trades];

    const sameSymbolDirectionTrades = allTrades.filter(
      (t) =>
        t.symbol === new_signal.symbol &&
        t.tf === new_signal.tf &&
        t.direction === new_signal.direction,
    );

    if (sameSymbolDirectionTrades.length >= 1) {
      reason_codes.push('SAME_SYMBOL_DIRECTION_EXISTS');
      this.logger.warn(
        `Conflict detected for ${new_signal.symbol} ${new_signal.direction}: ${sameSymbolDirectionTrades.length} existing trades`,
      );
      return {
        decision: ConflictDecision.BLOCK,
        reason_codes,
        metadata: {
          existing_trades: sameSymbolDirectionTrades.map((t) => t.trade_uid),
        },
      };
    }

    const newSignalCluster = SYMBOL_TO_CLUSTER[new_signal.symbol] || 'UNKNOWN';
    const clusterLimit = limits.cluster_exposure_limits[newSignalCluster];

    if (clusterLimit !== undefined) {
      const clusterTrades = allTrades.filter(
        (t) => SYMBOL_TO_CLUSTER[t.symbol] === newSignalCluster,
      );

      const currentClusterExposure = clusterTrades.length * 25.0;
      const newExposure = currentClusterExposure + (new_signal.requested_stake || 25.0);

      if (newExposure > clusterLimit) {
        reason_codes.push('CLUSTER_EXPOSURE_LIMIT_EXCEEDED');
        this.logger.warn(
          `Cluster ${newSignalCluster} exposure ${newExposure} > limit ${clusterLimit}`,
        );
        return {
          decision: ConflictDecision.BLOCK,
          reason_codes,
          metadata: {
            cluster: newSignalCluster,
            current_exposure: currentClusterExposure,
            new_exposure: newExposure,
            limit: clusterLimit,
          },
        };
      }
    }

    const totalActiveTrades = allTrades.length;
    if (totalActiveTrades >= limits.max_concurrent_trades) {
      reason_codes.push('MAX_CONCURRENT_TRADES_EXCEEDED');
      this.logger.warn(
        `Max concurrent trades ${totalActiveTrades} >= limit ${limits.max_concurrent_trades}`,
      );
      return {
        decision: ConflictDecision.BLOCK,
        reason_codes,
      };
    }

    this.logger.log(
      `No conflict for signal ${new_signal.signal_id} (${new_signal.symbol} ${new_signal.direction})`,
    );
    return {
      decision: ConflictDecision.ALLOW,
      reason_codes: [],
    };
  }
}
