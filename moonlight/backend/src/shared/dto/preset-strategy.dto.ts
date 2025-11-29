import { IsString, IsEnum, IsNumber, IsArray, IsBoolean, IsOptional, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Timeframe } from '../enums/timeframe.enum';
import { SignalDirection } from './canonical-signal.dto';

export class PresetConditionDTO {
  @IsEnum(['RSI', 'BB', 'MACD', 'ADX', 'EMA'])
  indicator: 'RSI' | 'BB' | 'MACD' | 'ADX' | 'EMA';

  @IsEnum(Timeframe)
  tf: Timeframe;

  @IsNumber()
  @IsOptional()
  period?: number;

  @IsEnum(['<', '<=', '>', '>=', '==', '!='])
  @IsOptional()
  operator?: '<' | '<=' | '>' | '>=' | '==' | '!=';

  @IsNumber()
  @IsOptional()
  value?: number;

  @IsEnum(['<', '<=', '>', '>='])
  @IsOptional()
  width_operator?: '<' | '<=' | '>' | '>=';

  @IsNumber()
  @IsOptional()
  width_value?: number;
}

export class PresetEntryRuleDTO {
  @IsEnum(SignalDirection)
  direction: SignalDirection;

  @IsEnum(['ALL', 'ANY'])
  conditions_mode: 'ALL' | 'ANY';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PresetConditionDTO)
  conditions: PresetConditionDTO[];
}

export class PresetRiskRuleDTO {
  @IsNumber()
  @Min(0)
  @Max(1)
  min_ev: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  min_confidence: number;

  @IsNumber()
  @IsOptional()
  stake_fixed?: number;

  @IsNumber()
  @IsOptional()
  stake_pct_of_balance?: number;
}

export class PresetStrategyDTO {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsEnum(['scalping', 'mean_revert', 'trend_follow', 'other'])
  category: 'scalping' | 'mean_revert' | 'trend_follow' | 'other';

  @IsNumber()
  @Min(1)
  version: number;

  @IsArray()
  @IsString({ each: true })
  symbols: string[];

  @IsArray()
  @IsEnum(Timeframe, { each: true })
  timeframes: Timeframe[];

  @ValidateNested()
  @Type(() => PresetEntryRuleDTO)
  entry: PresetEntryRuleDTO;

  @ValidateNested()
  @Type(() => PresetRiskRuleDTO)
  risk: PresetRiskRuleDTO;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsBoolean()
  @IsOptional()
  enabled_by_default?: boolean;
}
