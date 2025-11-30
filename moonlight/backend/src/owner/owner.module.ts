import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { BacktestRun } from '../database/entities/backtest-run.entity';
import { BacktestTrade } from '../database/entities/backtest-trade.entity';
import { ExecutionConfig } from '../database/entities/execution-config.entity';
import { ProductExecutionConfig } from '../database/entities/product-execution-config.entity';
import { OwnerAccount } from '../database/entities/owner-account.entity';
import { OwnerService } from './owner.service';
import { OwnerController } from './owner.controller';
import { HistoryService } from './history/history.service';
import { BrokerModule } from '../broker/broker.module';
import { RiskModule } from '../risk/risk.module';
import { HardwareProfileService } from '../shared/config/hardware-profile.service';
import { EnvironmentService } from '../shared/config/environment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BacktestRun,
      BacktestTrade,
      ExecutionConfig,
      ProductExecutionConfig,
      OwnerAccount,
    ]),
    BullModule.registerQueue({ name: 'backtest' }),
    BrokerModule,
    RiskModule,
  ],
  controllers: [OwnerController],
  providers: [OwnerService, HistoryService, HardwareProfileService, EnvironmentService],
  exports: [OwnerService, HistoryService],
})
export class OwnerModule {}
