import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { DataService } from './data.service';
import { LiveCaptureService } from './capture/live-capture.service';
import { AutoInspectorService } from './inspector/auto-inspector.service';
import { TickCaptureDTO } from '../shared/dto/tick-capture.dto';
import { DataQualitySnapshotDTO } from '../shared/dto/data-quality-snapshot.dto';
import { Timeframe } from '../shared/enums/timeframe.enum';

@Controller('data')
export class DataController {
  constructor(
    private readonly dataService: DataService,
    private readonly liveCaptureService: LiveCaptureService,
    private readonly autoInspectorService: AutoInspectorService,
  ) {}

  @Post('capture')
  async captureData(@Body() input: TickCaptureDTO) {
    await this.liveCaptureService.captureBars(input);
    return { status: 'OK', bars_captured: input.bars.length };
  }

  @Get('status')
  getStatus() {
    return this.dataService.getStatus();
  }

  @Get('health/:symbol/:tf')
  async getDataHealth(
    @Param('symbol') symbol: string,
    @Param('tf') tf: string,
    @Query('date') date: string,
  ): Promise<DataQualitySnapshotDTO> {
    return this.autoInspectorService.inspectDay({
      symbol,
      tf: tf as Timeframe,
      date,
      actualTimestamps: [],
      dataSource: 'MANUAL_QUERY',
    });
  }
}
