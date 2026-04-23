import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrinityOversightModule } from '../trinity-oversight/trinity-oversight.module';
import { AICoachModule } from '../ai-coach/ai-coach.module';
import { ProductExecutionConfig } from '../database/entities/product-execution-config.entity';
import { V2SeedService } from './v2-seed.service';
import { V2SeedController } from './v2-seed.controller';
import { CEOBrainService } from './brains/ceo-brain.service';
import { TRADEBrainService } from './brains/trade-brain.service';
import { TESTBrainService } from './brains/test-brain.service';
import { MoeBrainController } from './moe-brain.controller';
import { GlobalMoEOrchestratorService } from './global-moe-orchestrator.service';
import { MoeEnsembleController } from './moe-ensemble.controller';
import { SynapticRulesService } from './synaptic/synaptic-rules.service';
import { SynapticController } from './synaptic/synaptic.controller';

/**
 * V2.0-γ: adds Global MoE Orchestrator + Ensemble controller.
 * - Exposes POST /api/moe/evaluate (full 3-brain ensemble).
 * - GET  /api/moe/weights (effective ensemble weights).
 * - Individual brain routes from V2.0-β still available.
 * - Execution-side gate lives in execution/moe-gate.service.ts
 *   and imports GlobalMoEOrchestratorService from here.
 */
@Module({
  imports: [
    TrinityOversightModule,
    AICoachModule,
    TypeOrmModule.forFeature([ProductExecutionConfig]),
  ],
  providers: [
    V2SeedService,
    CEOBrainService,
    TRADEBrainService,
    TESTBrainService,
    GlobalMoEOrchestratorService,
    SynapticRulesService,
  ],
  controllers: [V2SeedController, MoeBrainController, MoeEnsembleController, SynapticController],
  exports: [
    V2SeedService,
    CEOBrainService,
    TRADEBrainService,
    TESTBrainService,
    GlobalMoEOrchestratorService,
    SynapticRulesService,
    TrinityOversightModule,
  ],
})
export class MoeBrainModule {}
