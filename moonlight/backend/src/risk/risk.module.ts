import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ARTEngineService } from './art-engine/art-engine.service';
import { RiskProfileService } from './risk-profile.service';
import { RiskGuardrailService } from './risk-guardrail.service';
import { RiskProfile } from '../database/entities/risk-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RiskProfile])],
  providers: [ARTEngineService, RiskProfileService, RiskGuardrailService],
  exports: [ARTEngineService, RiskProfileService, RiskGuardrailService],
})
export class RiskModule {}
