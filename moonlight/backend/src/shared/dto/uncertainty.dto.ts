import { IsNumber, IsString, IsEnum, Min, Max } from 'class-validator';

export enum UncertaintyLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export class TripleCheckInputDTO {
  regime_state?: any;
  data_quality?: any;
  model_stats?: {
    live_wr: number;
    backtest_wr: number;
    oos_wr: number;
    trades: number;
  };
}

export class TripleCheckResultDTO {
  @IsNumber()
  @Min(0)
  @Max(1)
  u1_score: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  u2_score: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  u3_score: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  uncertainty_score: number;

  @IsEnum(UncertaintyLevel)
  level: UncertaintyLevel;
}
