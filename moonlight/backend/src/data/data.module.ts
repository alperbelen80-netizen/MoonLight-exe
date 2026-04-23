import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { DataController } from './data.controller';
import { WebhookController } from './webhook.controller';
import { DataService } from './data.service';
import { LiveCaptureService } from './capture/live-capture.service';
import { TFResamplerService } from './resample/tf-resampler.service';
import { ResampleProcessor } from './resample/resample.processor';
import { AutoInspectorService } from './inspector/auto-inspector.service';
import { ParquetImportService } from './import/parquet-import.service';
import { ParquetImportController } from './import/parquet-import.controller';
import { RegimeDetectorService } from './regime-detector.service';
import { DataFeedOrchestrator } from './sources/data-feed-orchestrator.service';
import { StrategyModule } from '../strategy/strategy.module';

// V2.5-1: StrategyModule is needed because RegimeDetectorService depends on
// IndicatorService. StrategyModule transitively imports AICoachModule which
// imports DataModule — creating a cycle. We break it with `forwardRef`.

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'tf-resample',
    }),
    forwardRef(() => StrategyModule),
  ],
  controllers: [DataController, ParquetImportController, WebhookController],
  providers: [
    DataService,
    LiveCaptureService,
    TFResamplerService,
    ResampleProcessor,
    AutoInspectorService,
    ParquetImportService,
    RegimeDetectorService,
    DataFeedOrchestrator,
  ],
  exports: [
    DataService,
    LiveCaptureService,
    TFResamplerService,
    AutoInspectorService,
    RegimeDetectorService,
    DataFeedOrchestrator,
  ],
})
export class DataModule {}
