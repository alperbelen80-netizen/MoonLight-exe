import { IsString, IsEnum, IsNumber, IsISO8601, IsBoolean, IsOptional, Min, Max, Matches } from 'class-validator';
import { Timeframe } from '../enums/timeframe.enum';

export enum QualityGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  REJECTED = 'REJECTED',
}

export class DataQualitySnapshotDTO {
  @IsString()
  snapshot_id: string;

  @IsString()
  symbol: string;

  @IsEnum(Timeframe)
  tf: Timeframe;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD format' })
  date: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  coverage_pct: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  gap_pct: number;

  @IsEnum(QualityGrade)
  quality_grade: QualityGrade;

  @IsNumber()
  @Min(0)
  total_expected_bars: number;

  @IsNumber()
  @Min(0)
  total_actual_bars: number;

  @IsNumber()
  @Min(0)
  total_gaps: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  max_gap_duration_minutes?: number;

  @IsBoolean()
  @IsOptional()
  has_spike?: boolean;

  @IsBoolean()
  @IsOptional()
  has_outlier?: boolean;

  @IsISO8601({ strict: true })
  inspected_at_utc: string;

  @IsString()
  data_source: string;
}
