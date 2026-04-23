import { Module } from '@nestjs/common';
import { AlertDispatcherService } from './alert-dispatcher.service';
import { AlertThresholdMonitor } from './alert-threshold-monitor.service';
import { AlertsDispatcherController } from './alerts-dispatcher.controller';
import { AICoachModule } from '../ai-coach/ai-coach.module';

@Module({
  imports: [AICoachModule],
  controllers: [AlertsDispatcherController],
  providers: [AlertDispatcherService, AlertThresholdMonitor],
  exports: [AlertDispatcherService],
})
export class AlertsDispatcherModule {}
