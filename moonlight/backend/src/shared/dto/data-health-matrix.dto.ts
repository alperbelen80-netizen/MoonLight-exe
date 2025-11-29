import { IsString, IsNumber, IsEnum, Min, Max } from 'class-validator';

export enum QualityGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  REJECTED = 'REJECTED',
}

export class DataHealthItemDTO {
  @IsString()
  symbol: string;

  @IsString()
  tf: string;

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
}

export class DataHealthMatrixDTO {
  items: DataHealthItemDTO[];
  generated_at_utc: string;
}
