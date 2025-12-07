import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { HardwareProfileService } from './config/hardware-profile.service';
import { EnvironmentService } from './config/environment.service';
import { PolicyLoaderService } from './config/policy-loader.service';
import { PreFlightChecklistService } from './services/pre-flight-checklist.service';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: 'backtest' }),
  ],
  providers: [
    HardwareProfileService,
    EnvironmentService,
    PolicyLoaderService,
    PreFlightChecklistService,
  ],
  exports: [
    HardwareProfileService,
    EnvironmentService,
    PolicyLoaderService,
    PreFlightChecklistService,
  ],
})
export class SharedModule {}
