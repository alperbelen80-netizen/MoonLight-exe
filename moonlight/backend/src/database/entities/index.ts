// MoonLight — Explicit entity registry.
// CRITICAL: glob patterns (`__dirname + '/**/*.entity.js'`) DO NOT WORK in
// esbuild bundles (all source files are collapsed into a single backend.js).
// We MUST list every entity explicitly so TypeORM can register them
// correctly in the packaged Electron app. Every new *.entity.ts file must
// be registered here.
import { Alert } from './alert.entity';
import { ApprovalQueue } from './approval-queue.entity';
import { BacktestRun } from './backtest-run.entity';
import { BacktestTrade } from './backtest-trade.entity';
import { CircuitBreakerEvent } from './circuit-breaker-event.entity';
import { ConfigSnapshot } from './config-snapshot.entity';
import { ExecutionConfig } from './execution-config.entity';
import { ExpertPrior } from './expert-prior.entity';
import { LearningTickHistory } from './learning-tick-history.entity';
import { LiveSignal } from './live-signal.entity';
import { LiveStrategyPerformance } from './live-strategy-performance.entity';
import { OwnerAccount } from './owner-account.entity';
import { ProductExecutionConfig } from './product-execution-config.entity';
import { ReconciliationRun } from './reconciliation-run.entity';
import { RiskProfile } from './risk-profile.entity';

export const ALL_ENTITIES = [
  Alert,
  ApprovalQueue,
  BacktestRun,
  BacktestTrade,
  CircuitBreakerEvent,
  ConfigSnapshot,
  ExecutionConfig,
  ExpertPrior,
  LearningTickHistory,
  LiveSignal,
  LiveStrategyPerformance,
  OwnerAccount,
  ProductExecutionConfig,
  ReconciliationRun,
  RiskProfile,
];

export {
  Alert,
  ApprovalQueue,
  BacktestRun,
  BacktestTrade,
  CircuitBreakerEvent,
  ConfigSnapshot,
  ExecutionConfig,
  ExpertPrior,
  LearningTickHistory,
  LiveSignal,
  LiveStrategyPerformance,
  OwnerAccount,
  ProductExecutionConfig,
  ReconciliationRun,
  RiskProfile,
};
