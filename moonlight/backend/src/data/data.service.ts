import { Injectable, Logger } from '@nestjs/common';
import { LiveCaptureService } from './capture/live-capture.service';
import { TFResamplerService } from './resample/tf-resampler.service';
import { AutoInspectorService } from './inspector/auto-inspector.service';

@Injectable()
export class DataService {
  private readonly logger = new Logger(DataService.name);

  constructor(
    private readonly liveCaptureService: LiveCaptureService,
    private readonly tfResamplerService: TFResamplerService,
    private readonly autoInspectorService: AutoInspectorService,
  ) {}

  getStatus() {
    return {
      module: 'DataService',
      status: 'ACTIVE',
      capture_active: true,
      resample_queue_active: true,
    };
  }
}
