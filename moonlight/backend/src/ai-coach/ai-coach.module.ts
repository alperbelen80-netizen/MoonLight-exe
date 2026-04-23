import { Module } from '@nestjs/common';
import { AICoachService } from './ai-coach.service';
import { AICoachController } from './ai-coach.controller';
import { DataProvidersController } from '../data/data-providers.controller';
import { DataModule } from '../data/data.module';

@Module({
  imports: [DataModule],
  controllers: [AICoachController, DataProvidersController],
  providers: [AICoachService],
  exports: [AICoachService],
})
export class AICoachModule {}
