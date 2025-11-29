import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ExecutionModule } from './execution/execution.module';
import { RiskModule } from './risk/risk.module';
import { BrokerModule } from './broker/broker.module';
import { DataModule } from './data/data.module';
import { StrategyModule } from './strategy/strategy.module';
import { BacktestModule } from './backtest/backtest.module';
import { ReportingModule } from './reporting/reporting.module';
import { OwnerModule } from './owner/owner.module';
import { ConfigModule } from './config/config.module';
import { AlertsModule } from './alerts/alerts.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DB_PATH || './data/db/moonlight.sqlite',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.NODE_ENV === 'development',
      logging: false,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    ExecutionModule,
    RiskModule,
    BrokerModule,
    DataModule,
    StrategyModule,
    BacktestModule,
    ReportingModule,
    OwnerModule,
    ConfigModule,
    AlertsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
