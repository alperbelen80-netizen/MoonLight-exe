import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { BacktestService } from './backtest.service';
import { ReplayRunnerService } from './replay-runner.service';
import { SimFactoryService } from './sim-factory.service';
import { BacktestProcessor } from './backtest.processor';
import { BacktestController } from './backtest.controller';
import { MonteCarloService } from './monte-carlo.service';
import { WalkForwardService } from './walk-forward.service';
import { BacktestRun } from '../database/entities/backtest-run.entity';
import { BacktestTrade } from '../database/entities/backtest-trade.entity';
import { StrategyModule } from '../strategy/strategy.module';
import { ConfigModule } from '../config/config.module';
import { RiskModule } from '../risk/risk.module';
import { ReportingModule } from '../reporting/reporting.module';
import { HardwareProfileService } from '../shared/config/hardware-profile.service';
import { EnvironmentService } from '../shared/config/environment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([BacktestRun, BacktestTrade]),
    BullModule.registerQueue({ name: 'backtest' }),
    StrategyModule,
    ConfigModule,
    RiskModule,
    ReportingModule,
  ],
  controllers: [BacktestController],
  providers: [
    BacktestService,
    ReplayRunnerService,
    SimFactoryService,
    BacktestProcessor,
    MonteCarloService,
    WalkForwardService,
    HardwareProfileService,
    EnvironmentService,
  ],
  exports: [BacktestService, SimFactoryService, MonteCarloService, WalkForwardService],
})
export class BacktestModule {}
