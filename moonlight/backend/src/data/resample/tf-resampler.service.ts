import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { OhlcvBarDTO } from '../../shared/dto/ohlcv-bar.dto';
import { ResampleJobDTO } from '../../shared/dto/resample-job.dto';
import { Timeframe, TIMEFRAME_TO_MS } from '../../shared/enums/timeframe.enum';

@Injectable()
export class TFResamplerService {
  private readonly logger = new Logger(TFResamplerService.name);

  constructor(
    @InjectQueue('tf-resample')
    private resampleQueue: Queue,
  ) {}

  resampleBars(params: {
    fromTf: Timeframe;
    toTf: Timeframe;
    bars: OhlcvBarDTO[];
  }): OhlcvBarDTO[] {
    const { fromTf, toTf, bars } = params;

    if (bars.length === 0) {
      return [];
    }

    const fromMs = TIMEFRAME_TO_MS[fromTf];
    const toMs = TIMEFRAME_TO_MS[toTf];

    if (!fromMs || !toMs) {
      throw new Error(`Invalid timeframe: from=${fromTf}, to=${toTf}`);
    }

    if (toMs <= fromMs) {
      throw new Error(
        `Cannot resample to smaller or equal timeframe: ${fromTf} -> ${toTf}`,
      );
    }

    const sorted = [...bars].sort(
      (a, b) => new Date(a.ts_utc).getTime() - new Date(b.ts_utc).getTime(),
    );

    const slots = new Map<number, OhlcvBarDTO[]>();

    sorted.forEach((bar) => {
      const timestamp = new Date(bar.ts_utc).getTime();
      const slotStart = Math.floor(timestamp / toMs) * toMs;

      if (!slots.has(slotStart)) {
        slots.set(slotStart, []);
      }
      slots.get(slotStart)!.push(bar);
    });

    const resampled: OhlcvBarDTO[] = [];

    for (const [slotStart, slotBars] of slots) {
      if (slotBars.length === 0) continue;

      const aggregated: OhlcvBarDTO = {
        symbol: slotBars[0].symbol,
        tf: toTf,
        ts_utc: new Date(slotStart).toISOString(),
        open: slotBars[0].open,
        high: Math.max(...slotBars.map((b) => b.high)),
        low: Math.min(...slotBars.map((b) => b.low)),
        close: slotBars[slotBars.length - 1].close,
        volume: slotBars.reduce((sum, b) => sum + b.volume, 0),
        source: slotBars[0].source,
      };

      resampled.push(aggregated);
    }

    return resampled;
  }

  async enqueueResampleJob(job: ResampleJobDTO): Promise<void> {
    this.logger.log(
      `Enqueueing resample job: ${job.symbol} ${job.from_tf}->${job.to_tf} (${job.date})`,
    );

    await this.resampleQueue.add('resample', job, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }
}
