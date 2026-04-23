import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrinityOversightModule } from '../trinity-oversight/trinity-oversight.module';
import { ProductExecutionConfig } from '../database/entities/product-execution-config.entity';
import { V2SeedService } from './v2-seed.service';
import { V2SeedController } from './v2-seed.controller';
// NOTE: V2.0-α wires the shared contracts + V2 product seed.
// Concrete MoE brains (CEO/TRADE/TEST) + Global Orchestrator land in V2.0-β/γ.

@Module({
  imports: [
    TrinityOversightModule,
    TypeOrmModule.forFeature([ProductExecutionConfig]),
  ],
  providers: [V2SeedService],
  controllers: [V2SeedController],
  exports: [V2SeedService, TrinityOversightModule],
})
export class MoeBrainModule {}
