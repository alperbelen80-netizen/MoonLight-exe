import { Module } from '@nestjs/common';
import { RiskProfileController } from './risk-profile.controller';

// Lightweight standalone module – does not share state with existing
// Risk service; acts as a UI-visible policy layer we can wire deeper later.
@Module({
  controllers: [RiskProfileController],
})
export class RiskProfileModule {}
