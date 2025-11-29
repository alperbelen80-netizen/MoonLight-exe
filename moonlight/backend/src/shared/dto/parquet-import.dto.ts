import { IsString, IsNumber, IsISO8601, IsArray, IsOptional, ValidateNested, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Timeframe } from '../enums/timeframe.enum';

export class ParquetFileCandidateDTO {
  @IsString()
  full_path: string;

  @IsNumber()
  @Min(0)
  size_bytes: number;

  @IsISO8601({ strict: true })
  modified_at_utc: string;
}

export class DateRangeDTO {
  @IsString()
  from: string;

  @IsString()
  to: string;
}

export class ParquetImportPreviewDTO {
  @ValidateNested()
  @Type(() => ParquetFileCandidateDTO)
  file: ParquetFileCandidateDTO;

  @IsString()
  @IsOptional()
  detected_symbol?: string;

  @IsEnum(Timeframe)
  @IsOptional()
  detected_tf?: Timeframe;

  @ValidateNested()
  @Type(() => DateRangeDTO)
  @IsOptional()
  detected_date_range?: DateRangeDTO;

  @IsArray()
  @IsString({ each: true })
  suggestions: string[];
}

export class ImportMappingDTO {
  @IsString()
  source_path: string;

  @IsString()
  symbol: string;

  @IsEnum(Timeframe)
  tf: Timeframe;

  @IsString()
  @IsOptional()
  date?: string;
}

export class ParquetImportApplyRequestDTO {
  @IsString()
  base_dir: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportMappingDTO)
  mappings: ImportMappingDTO[];
}
