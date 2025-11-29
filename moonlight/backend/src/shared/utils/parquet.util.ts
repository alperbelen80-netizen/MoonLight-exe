import * as fs from 'fs/promises';
import * as path from 'path';
import { OhlcvBarDTO } from '../dto/ohlcv-bar.dto';
import { Timeframe } from '../enums/timeframe.enum';

export interface WriteParquetParams {
  baseDir: string;
  symbol: string;
  tf: Timeframe;
  bars: OhlcvBarDTO[];
}

export async function writeOhlcvBarsToParquet(
  params: WriteParquetParams,
): Promise<void> {
  const { baseDir, symbol, tf, bars } = params;

  if (bars.length === 0) {
    return;
  }

  const barsByDate = new Map<string, OhlcvBarDTO[]>();

  bars.forEach((bar) => {
    const date = bar.ts_utc.split('T')[0];
    if (!barsByDate.has(date)) {
      barsByDate.set(date, []);
    }
    barsByDate.get(date)!.push(bar);
  });

  for (const [date, dateBars] of barsByDate) {
    const filePath = path.join(baseDir, 'raw', symbol, tf, `${date}.parquet`);
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });

    const jsonData = dateBars.map((bar) => ({
      symbol: bar.symbol,
      tf: bar.tf,
      ts_utc: bar.ts_utc,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      source: bar.source,
    }));

    await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), 'utf-8');
  }
}

export async function readOhlcvBarsFromParquet(
  params: { baseDir: string; symbol: string; tf: Timeframe; date: string },
): Promise<OhlcvBarDTO[]> {
  const { baseDir, symbol, tf, date } = params;
  const filePath = path.join(baseDir, 'raw', symbol, tf, `${date}.parquet`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const jsonData = JSON.parse(content);
    return jsonData as OhlcvBarDTO[];
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export async function readOhlcvBarsBetweenDates(
  params: { baseDir: string; symbol: string; tf: Timeframe; fromDate: string; toDate: string },
): Promise<OhlcvBarDTO[]> {
  const { baseDir, symbol, tf, fromDate, toDate } = params;

  const allBars: OhlcvBarDTO[] = [];

  const startDate = new Date(fromDate);
  const endDate = new Date(toDate);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    const bars = await readOhlcvBarsFromParquet({
      baseDir,
      symbol,
      tf,
      date: dateStr,
    });

    allBars.push(...bars);
  }

  return allBars.sort(
    (a, b) => new Date(a.ts_utc).getTime() - new Date(b.ts_utc).getTime(),
  );
}
