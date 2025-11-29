import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DataController } from './data.controller';
import { DataService } from './data.service';
import { LiveCaptureService } from './capture/live-capture.service';
import { TFResamplerService } from './resample/tf-resampler.service';
import { ResampleProcessor } from './resample/resample.processor';
import { AutoInspectorService } from './inspector/auto-inspector.service';
import { ParquetImportService } from './import/parquet-import.service';
import { ParquetImportController } from './import/parquet-import.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'tf-resample',
    }),
  ],
  controllers: [DataController, ParquetImportController],
  providers: [
    DataService,
    LiveCaptureService,
    TFResamplerService,
    ResampleProcessor,
    AutoInspectorService,
    ParquetImportService,
  ],
  exports: [
    DataService,
    LiveCaptureService,
    TFResamplerService,
    AutoInspectorService,
  ],
})
export class DataModule {}
