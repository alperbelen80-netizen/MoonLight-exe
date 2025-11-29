import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OhlcvBarDTO } from './ohlcv-bar.dto';

export class TickCaptureDTO {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OhlcvBarDTO)
  bars: OhlcvBarDTO[];

  @IsString()
  data_source: string;
}
