import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ResampleJobDTO } from '../../shared/dto/resample-job.dto';
import { TFResamplerService } from './tf-resampler.service';
import { readOhlcvBarsFromParquet, writeOhlcvBarsToParquet } from '../../shared/utils/parquet.util';

@Processor('tf-resample')
export class ResampleProcessor {
  private readonly logger = new Logger(ResampleProcessor.name);
  private readonly baseDir = process.env.DATA_DIR || './data';

  constructor(private readonly tfResamplerService: TFResamplerService) {}

  @Process('resample')
  async handleResample(job: Job<ResampleJobDTO>): Promise<void> {
    const { symbol, from_tf, to_tf, date, source } = job.data;

    this.logger.log(
      `Processing resample job: ${symbol} ${from_tf}->${to_tf} (${date})`,
    );

    const sourceBars = await readOhlcvBarsFromParquet({
      baseDir: this.baseDir,
      symbol,
      tf: from_tf,
      date,
    });

    if (sourceBars.length === 0) {
      this.logger.warn(
        `No source bars found for ${symbol} ${from_tf} (${date}), skipping`,
      );
      return;
    }

    const resampledBars = this.tfResamplerService.resampleBars({
      fromTf: from_tf,
      toTf: to_tf,
      bars: sourceBars,
    });

    this.logger.log(
      `Resampled ${sourceBars.length} bars -> ${resampledBars.length} bars`,
    );

    await writeOhlcvBarsToParquet({
      baseDir: this.baseDir,
      symbol,
      tf: to_tf,
      bars: resampledBars,
    });

    this.logger.log(`Resample job complete: ${symbol} ${from_tf}->${to_tf}`);
  }
}
