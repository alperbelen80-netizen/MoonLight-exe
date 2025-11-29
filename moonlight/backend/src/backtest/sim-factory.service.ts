import { Injectable, Logger } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { BacktestRunRequestDTO, BacktestRunSummaryDTO } from '../shared/dto/backtest.dto';
import { SimPolicy } from '../shared/enums/sim-policy.enum';
import { Timeframe } from '../shared/enums/timeframe.enum';
import { Environment } from '../shared/dto/canonical-signal.dto';

@Injectable()
export class SimFactoryService {
  private readonly logger = new Logger(SimFactoryService.name);

  private readonly policyConfig = {
    [SimPolicy.LENIENT]: {
      minEv: 0.0,
      minConfidence: 0.0,
    },
    [SimPolicy.STRICT]: {
      minEv: 0.02,
      minConfidence: 0.6,
    },
  };

  constructor(private readonly backtestService: BacktestService) {}

  async runSinglePresetBacktest(params: {
    presetId: string;
    symbol: string;
    tf: Timeframe;
    fromDate: string;
    toDate: string;
    initialBalance: number;
    policy: SimPolicy;
  }): Promise<BacktestRunSummaryDTO> {
    const { presetId, symbol, tf, fromDate, toDate, initialBalance, policy } = params;

    const policySettings = this.policyConfig[policy];

    const request: BacktestRunRequestDTO = {
      symbols: [symbol],
      timeframes: [tf],
      strategy_ids: [presetId],
      from_date: fromDate,
      to_date: toDate,
      initial_balance: initialBalance,
      risk_profile_id: `PROFILE_BACKTEST_${policy}`,
      environment: Environment.BACKTEST,
      note: `Single preset backtest: ${presetId}, policy: ${policy}`,
    };

    this.logger.log(
      `Running single preset backtest: ${presetId} on ${symbol} ${tf} (${policy})`,
    );

    return this.backtestService.startBacktest(request);
  }
}
