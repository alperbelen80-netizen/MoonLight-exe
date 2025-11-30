import { Injectable, Logger } from '@nestjs/common';

export type MoonlightEnvironment = 'LIVE' | 'SANDBOX';

@Injectable()
export class EnvironmentService {
  private readonly logger = new Logger(EnvironmentService.name);
  private readonly environment: MoonlightEnvironment;

  constructor() {
    const env = process.env.MOONLIGHT_ENVIRONMENT || 'SANDBOX';
    this.environment = env as MoonlightEnvironment;

    this.logger.log(`MoonLight Environment: ${this.environment}`);
  }

  getEnvironment(): MoonlightEnvironment {
    return this.environment;
  }

  isLive(): boolean {
    return this.environment === 'LIVE';
  }

  isSandbox(): boolean {
    return this.environment === 'SANDBOX';
  }
}
