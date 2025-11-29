import { IsString, IsEnum, IsArray, IsNumber, IsBoolean, IsOptional, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { Timeframe } from '../enums/timeframe.enum';

export class StrategyParameterDefinition {
  @IsString()
  name: string;

  @IsEnum(['number', 'string', 'boolean', 'enum'])
  type: 'number' | 'string' | 'boolean' | 'enum';

  @IsOptional()
  default_value?: number | string | boolean;

  @IsNumber()
  @IsOptional()
  min?: number;

  @IsNumber()
  @IsOptional()
  max?: number;

  @IsArray()
  @IsOptional()
  allowed_values?: (string | number)[];

  @IsString()
  @IsOptional()
  description?: string;
}

export class StrategyDefinitionDTO {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['scalping', 'mean_revert', 'trend_follow', 'other'])
  category: 'scalping' | 'mean_revert' | 'trend_follow' | 'other';

  @IsNumber()
  @Min(1)
  version: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyParameterDefinition)
  parameters: StrategyParameterDefinition[];

  @IsArray()
  @IsEnum(Timeframe, { each: true })
  allowed_timeframes: Timeframe[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  allowed_symbols?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}

export class StrategyConfigDTO {
  @IsString()
  strategy_id: string;

  @IsBoolean()
  enabled: boolean;

  @IsArray()
  @IsString({ each: true })
  symbols: string[];

  @IsArray()
  @IsEnum(Timeframe, { each: true })
  timeframes: Timeframe[];

  @IsString()
  risk_profile_id: string;

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
  max_concurrent_trades?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
