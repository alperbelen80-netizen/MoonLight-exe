import { Module } from '@nestjs/common';
import { HealthzController } from './healthz.controller';
import { AICoachModule } from '../ai-coach/ai-coach.module';
import { DataModule } from '../data/data.module';

@Module({
  imports: [AICoachModule, DataModule],
  controllers: [HealthzController],
})
export class HealthModule {}
