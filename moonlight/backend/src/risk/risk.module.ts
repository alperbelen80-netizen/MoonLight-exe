import { Module } from '@nestjs/common';
import { ARTEngineService } from './art-engine/art-engine.service';

@Module({
  providers: [ARTEngineService],
  exports: [ARTEngineService],
})
export class RiskModule {}
