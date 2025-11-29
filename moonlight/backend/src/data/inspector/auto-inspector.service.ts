import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DataQualitySnapshotDTO } from '../../shared/dto/data-quality-snapshot.dto';
import { Timeframe, TIMEFRAME_TO_EXPECTED_BARS_PER_DAY } from '../../shared/enums/timeframe.enum';
import { gradeDataQuality } from './quality-grader.util';

export interface InspectDayParams {
  symbol: string;
  tf: Timeframe;
  date: string;
  actualTimestamps: string[];
  dataSource: string;
}

@Injectable()
export class AutoInspectorService {
  private readonly logger = new Logger(AutoInspectorService.name);

  inspectDay(params: InspectDayParams): DataQualitySnapshotDTO {
    const { symbol, tf, date, actualTimestamps, dataSource } = params;

    const totalExpectedBars = TIMEFRAME_TO_EXPECTED_BARS_PER_DAY[tf] || 1440;
    const totalActualBars = actualTimestamps.length;
    const totalGaps = Math.max(0, totalExpectedBars - totalActualBars);

    const coveragePct = (totalActualBars / totalExpectedBars) * 100;
    const gapPct = (totalGaps / totalExpectedBars) * 100;

    const qualityGrade = gradeDataQuality({ coveragePct, gapPct });

    const snapshot: DataQualitySnapshotDTO = {
      snapshot_id: `SNAPSHOT_${uuidv4()}`,
      symbol,
      tf,
      date,
      coverage_pct: parseFloat(coveragePct.toFixed(2)),
      gap_pct: parseFloat(gapPct.toFixed(2)),
      quality_grade: qualityGrade,
      total_expected_bars: totalExpectedBars,
      total_actual_bars: totalActualBars,
      total_gaps: totalGaps,
      max_gap_duration_minutes: undefined,
      has_spike: false,
      has_outlier: false,
      inspected_at_utc: new Date().toISOString(),
      data_source: dataSource,
    };

    this.logger.log(
      `Inspected ${symbol} ${tf} (${date}): ${coveragePct.toFixed(2)}% coverage, grade ${qualityGrade}`,
    );

    return snapshot;
  }
}
