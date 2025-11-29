import { Injectable, Logger } from '@nestjs/common';
import { TickCaptureDTO } from '../../shared/dto/tick-capture.dto';
import { writeOhlcvBarsToParquet } from '../../shared/utils/parquet.util';

@Injectable()
export class LiveCaptureService {
  private readonly logger = new Logger(LiveCaptureService.name);
  private readonly baseDir = process.env.DATA_DIR || './data';

  async captureBars(input: TickCaptureDTO): Promise<void> {
    const { bars, data_source } = input;

    if (bars.length === 0) {
      this.logger.warn('No bars to capture');
      return;
    }

    const barsBySymbolTf = new Map<string, typeof bars>();

    bars.forEach((bar) => {
      const key = `${bar.symbol}_${bar.tf}`;
      if (!barsBySymbolTf.has(key)) {
        barsBySymbolTf.set(key, []);
      }
      barsBySymbolTf.get(key)!.push(bar);
    });

    for (const [key, groupBars] of barsBySymbolTf) {
      const { symbol, tf } = groupBars[0];

      this.logger.log(
        `Capturing ${groupBars.length} bars for ${symbol} ${tf} (source: ${data_source})`,
      );

      await writeOhlcvBarsToParquet({
        baseDir: this.baseDir,
        symbol,
        tf,
        bars: groupBars,
      });
    }

    this.logger.log(`Capture complete: ${bars.length} bars written`);
  }
}
