import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { SharedModule } from './shared/shared.module';
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
import { AICoachModule } from './ai-coach/ai-coach.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { HealthModule } from './health/health.module';
import { JournalModule } from './journal/journal.module';
import { RiskProfileModule } from './risk/risk-profile.module';
import { AlertsDispatcherModule } from './alerts/alerts-dispatcher.module';
import { MoeBrainModule } from './moe-brain/moe-brain.module';
import { TrinityOversightModule } from './trinity-oversight/trinity-oversight.module';
import { IndicatorRegistryModule } from './indicators/indicator-registry.module';
import { BrokerHealthModule } from './broker/health/broker-health.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: process.env.DB_PATH || './data/db/moonlight.sqlite',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: process.env.DB_SYNCHRONIZE === 'false' ? false : true,
      logging: false,
    }),
    BullModule.forRoot(
      process.env.REDIS_MOCK === 'true'
        ? {
            // Sandbox / dev mode: use in-memory ioredis-mock so we can run
            // without a real Redis instance. Strictly for local development.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            createClient: () => new (require('ioredis-mock'))(),
          }
        : {
            redis: {
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379', 10),
            },
          },
    ),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL_S || '60', 10) * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
      },
    ]),
    SharedModule,
    ExecutionModule,
    RiskModule,
    RiskProfileModule,
    BrokerModule,
    DataModule,
    StrategyModule,
    BacktestModule,
    ReportingModule,
    OwnerModule,
    ConfigModule,
    AlertsModule,
    AlertsDispatcherModule,
    AICoachModule,
    HealthModule,
    JournalModule,
    TrinityOversightModule,
    MoeBrainModule,
    IndicatorRegistryModule,
    BrokerHealthModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
