import { IsString, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BacktestRunSummaryDTO } from './backtest.dto';

export class BacktestMetricBreakdownItemDTO {
  @IsString()
  key: string;

  @IsNumber()
  @Min(0)
  trades: number;

  @IsNumber()
  win_rate: number;

  @IsNumber()
  net_pnl: number;

  @IsNumber()
  avg_roi_per_trade: number;
}

export class EquityPointDTO {
  @IsString()
  ts_utc: string;

  @IsNumber()
  equity: number;
}

export class BacktestAdvancedReportDTO {
  @IsString()
  run_id: string;

  @ValidateNested()
  @Type(() => BacktestRunSummaryDTO)
  summary: BacktestRunSummaryDTO;

  @IsNumber()
  sharpe_ratio: number;

  @IsNumber()
  profit_factor: number;

  @IsNumber()
  expectancy_per_trade: number;

  @IsNumber()
  @Min(0)
  max_consecutive_wins: number;

  @IsNumber()
  @Min(0)
  max_consecutive_losses: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BacktestMetricBreakdownItemDTO)
  per_symbol: BacktestMetricBreakdownItemDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BacktestMetricBreakdownItemDTO)
  per_timeframe: BacktestMetricBreakdownItemDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BacktestMetricBreakdownItemDTO)
  per_strategy: BacktestMetricBreakdownItemDTO[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EquityPointDTO)
  equity_curve: EquityPointDTO[];
}
