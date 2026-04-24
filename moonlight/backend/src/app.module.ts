import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import * as path from 'path';
import * as fs from 'fs';
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
import { CrashReporterModule } from './health/crash-reporter.module';
import { RuntimeFlagsModule } from './runtime-flags/runtime-flags.module';
import { JournalModule } from './journal/journal.module';
import { RiskProfileModule } from './risk/risk-profile.module';
import { AlertsDispatcherModule } from './alerts/alerts-dispatcher.module';
import { MoeBrainModule } from './moe-brain/moe-brain.module';
import { TrinityOversightModule } from './trinity-oversight/trinity-oversight.module';
import { IndicatorRegistryModule } from './indicators/indicator-registry.module';
import { BrokerHealthModule } from './broker/health/broker-health.module';
import { SecurityModule } from './security/security.module';
import { ALL_ENTITIES } from './database/entities';

/**
 * Resolve the SQLite database path deterministically across environments:
 *   1. If DB_PATH is set (power-user override) → use it verbatim.
 *   2. If MOONLIGHT_USER_DATA_DIR is set (injected by Electron main process
 *      from `app.getPath('userData')`) → put db under `<userData>/data/db/`.
 *   3. Otherwise fall back to `./data/db/moonlight.sqlite` (dev mode, from
 *      backend/ cwd).
 *
 * This prevents the packaged Windows app from trying to write the DB into
 * the install directory (Program Files → permission denied) or into
 * whatever the spawned process's CWD happens to be.
 */
function resolveDbPath(): string {
  if (process.env.DB_PATH && process.env.DB_PATH.trim().length > 0) {
    return process.env.DB_PATH;
  }
  const userDataDir = process.env.MOONLIGHT_USER_DATA_DIR;
  const baseDir =
    userDataDir && userDataDir.trim().length > 0
      ? path.join(userDataDir, 'data', 'db')
      : path.resolve(process.cwd(), 'data', 'db');
  try {
    fs.mkdirSync(baseDir, { recursive: true });
  } catch {
    /* best-effort — TypeOrm will report the real failure if this blows up */
  }
  return path.join(baseDir, 'moonlight.sqlite');
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: resolveDbPath(),
      // CRITICAL: we list entities EXPLICITLY because glob patterns
      // (`__dirname + '/**/*.entity.js'`) do not work inside an esbuild
      // bundle — every entity file is collapsed into a single backend.js
      // and the glob silently returns an empty array.
      entities: ALL_ENTITIES,
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
    CrashReporterModule,
    RuntimeFlagsModule,
    JournalModule,
    TrinityOversightModule,
    MoeBrainModule,
    IndicatorRegistryModule,
    BrokerHealthModule,
    SecurityModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
