import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { resolveConfigPath } from '../shared/utils/resolve-config-path';

export interface SystemPolicy {
  version: string;
  last_updated?: string;
  risk: any;
  execution: any;
  strategy: any;
  data: any;
  brokers: any;
  [key: string]: any;
}

@Injectable()
export class PolicyLoaderService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PolicyLoaderService.name);
  private policy?: SystemPolicy;

  async onApplicationBootstrap(): Promise<void> {
    const policyPath = resolveConfigPath('config', 'policy.yaml');

    try {
      const content = fs.readFileSync(policyPath, 'utf-8');
      this.policy = yaml.load(content) as SystemPolicy;

      this.logger.log(
        `System policy loaded: v${this.policy.version} (updated: ${this.policy.last_updated || 'unknown'})`,
      );

      this.validatePolicy();
    } catch (error: any) {
      this.logger.error(
        `Failed to load policy.yaml: ${error?.message}. Using defaults.`,
      );
    }
  }

  getPolicy(): SystemPolicy | undefined {
    return this.policy;
  }

  getRiskPolicy(): any {
    return this.policy?.risk || {};
  }

  getExecutionPolicy(): any {
    return this.policy?.execution || {};
  }

  getStrategyPolicy(): any {
    return this.policy?.strategy || {};
  }

  private validatePolicy(): void {
    if (!this.policy) return;

    const required = ['risk', 'execution', 'strategy', 'data', 'brokers'];
    const missing = required.filter((key) => !this.policy![key]);

    if (missing.length > 0) {
      this.logger.warn(
        `Policy validation warning: Missing sections: ${missing.join(', ')}`,
      );
    } else {
      this.logger.log('✅ Policy validation: All sections present');
    }
  }
}
