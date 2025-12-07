import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DataFeedOrchestrator } from '../data/sources/data-feed-orchestrator.service';
import { PolicyLoaderService } from '../config/policy-loader.service';

export interface PreFlightCheckResult {
  passed: boolean;
  checks: {
    name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    message: string;
  }[];
  errors: string[];
  warnings: string[];
}

@Injectable()
export class PreFlightChecklistService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PreFlightChecklistService.name);

  constructor(
    @InjectConnection()
    private readonly dbConnection: Connection,
    @InjectQueue('backtest')
    private readonly backtestQueue: Queue,
    private readonly dataFeedOrchestrator: DataFeedOrchestrator,
    private readonly policyLoader: PolicyLoaderService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.logger.log('\n' + '='.repeat(60));
    this.logger.log('MOONLIGHT PRE-FLIGHT CHECKLIST');
    this.logger.log('='.repeat(60) + '\n');

    const result = await this.runChecklist();

    result.checks.forEach((check) => {
      const icon = check.status === 'PASS' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
      this.logger.log(`${icon} ${check.name}: ${check.message}`);
    });

    if (result.warnings.length > 0) {
      this.logger.warn('\nWARNINGS:');
      result.warnings.forEach((w) => this.logger.warn(`  ⚠️ ${w}`));
    }

    if (result.errors.length > 0) {
      this.logger.error('\nERRORS:');
      result.errors.forEach((e) => this.logger.error(`  ❌ ${e}`));
    }

    this.logger.log('\n' + '='.repeat(60));

    if (result.passed) {
      this.logger.log('✅ PRE-FLIGHT COMPLETE: System ready for operation');
    } else {
      this.logger.error('❌ PRE-FLIGHT FAILED: Critical issues detected');
      this.logger.error('System may not function correctly. Review errors above.');
    }

    this.logger.log('='.repeat(60) + '\n');
  }

  async runChecklist(): Promise<PreFlightCheckResult> {
    const checks = [];
    const errors = [];
    const warnings = [];
    let passed = true;

    const dbCheck = await this.checkDatabase();
    checks.push(dbCheck);
    if (dbCheck.status === 'FAIL') {
      passed = false;
      errors.push(dbCheck.message);
    }

    const redisCheck = await this.checkRedis();
    checks.push(redisCheck);
    if (redisCheck.status === 'FAIL') {
      passed = false;
      errors.push(redisCheck.message);
    }

    const envCheck = this.checkEnvironmentVariables();
    checks.push(envCheck);
    if (envCheck.status === 'WARN') {
      warnings.push(envCheck.message);
    }

    const dataFeedCheck = await this.checkDataFeed();
    checks.push(dataFeedCheck);
    if (dataFeedCheck.status === 'WARN') {
      warnings.push(dataFeedCheck.message);
    }

    const policyCheck = this.checkPolicy();
    checks.push(policyCheck);
    if (policyCheck.status === 'WARN') {
      warnings.push(policyCheck.message);
    }

    return {
      passed,
      checks,
      errors,
      warnings,
    };
  }

  private async checkDatabase(): Promise<any> {
    try {
      await this.dbConnection.query('SELECT 1');
      return {
        name: 'Database Connection',
        status: 'PASS',
        message: 'SQLite connected',
      };
    } catch (error: any) {
      return {
        name: 'Database Connection',
        status: 'FAIL',
        message: `Database error: ${error.message}`,
      };
    }
  }

  private async checkRedis(): Promise<any> {
    try {
      await this.backtestQueue.client.ping();
      return {
        name: 'Redis Connection',
        status: 'PASS',
        message: 'Redis connected',
      };
    } catch (error: any) {
      return {
        name: 'Redis Connection',
        status: 'FAIL',
        message: `Redis error: ${error.message}`,
      };
    }
  }

  private checkEnvironmentVariables(): any {
    const required = [
      'PORT',
      'DB_PATH',
      'REDIS_HOST',
      'ART_SIGNING_SECRET',
      'MOONLIGHT_ENVIRONMENT',
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      return {
        name: 'Environment Variables',
        status: 'WARN',
        message: `Missing: ${missing.join(', ')}`,
      };
    }

    return {
      name: 'Environment Variables',
      status: 'PASS',
      message: 'All required variables set',
    };
  }

  private async checkDataFeed(): Promise<any> {
    try {
      const adapter = this.dataFeedOrchestrator.getActiveAdapter();
      const connected = adapter.isConnected();

      if (connected) {
        return {
          name: 'Data Feed',
          status: 'PASS',
          message: `Active: ${this.dataFeedOrchestrator.getActiveProviderName()}`,
        };
      } else {
        return {
          name: 'Data Feed',
          status: 'WARN',
          message: 'Provider not connected (will auto-connect on signal request)',
        };
      }
    } catch (error: any) {
      return {
        name: 'Data Feed',
        status: 'WARN',
        message: `Error: ${error.message}`,
      };
    }
  }

  private checkPolicy(): any {
    const policy = this.policyLoader.getPolicy();

    if (policy) {
      return {
        name: 'Policy Configuration',
        status: 'PASS',
        message: `Loaded v${policy.version}`,
      };
    } else {
      return {
        name: 'Policy Configuration',
        status: 'WARN',
        message: 'Policy file not loaded, using defaults',
      };
    }
  }
}
