import { Controller, Get } from '@nestjs/common';
import { DataService } from './data.service';
import { AutoInspectorService } from './inspector/auto-inspector.service';
import { DataHealthMatrixDTO, DataHealthItemDTO } from '../shared/dto/data-health-matrix.dto';

@Controller('data')
export class DataController {
  constructor(
    private readonly dataService: DataService,
    private readonly autoInspectorService: AutoInspectorService,
  ) {}

  @Get('health/matrix')
  async getDataHealthMatrix(): Promise<DataHealthMatrixDTO> {
    const mockItems: DataHealthItemDTO[] = [
      {
        symbol: 'XAUUSD',
        tf: '1m',
        coverage_pct: 99.2,
        gap_pct: 0.8,
        quality_grade: 'A' as any,
      },
      {
        symbol: 'EURUSD',
        tf: '5m',
        coverage_pct: 96.5,
        gap_pct: 3.5,
        quality_grade: 'B' as any,
      },
      {
        symbol: 'BTCUSD',
        tf: '15m',
        coverage_pct: 92.1,
        gap_pct: 7.9,
        quality_grade: 'C' as any,
      },
    ];

    return {
      items: mockItems,
      generated_at_utc: new Date().toISOString(),
    };
  }
}
