import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';

export type HardwareProfileName = 'SAFE' | 'BALANCED' | 'MAXPOWER';

export interface HardwareProfile {
  name: HardwareProfileName;
  maxConcurrentTrades: number;
  maxConcurrentBacktests: number;
  maxQueueConcurrency: {
    execution: number;
    backtest: number;
  };
}

@Injectable()
export class HardwareProfileService {
  private readonly logger = new Logger(HardwareProfileService.name);
  private profiles: Record<HardwareProfileName, Omit<HardwareProfile, 'name'>>;
  private defaultProfile: HardwareProfileName;

  constructor() {
    const configPath = path.join(
      process.cwd(),
      'src',
      'config',
      'hardware-profiles.yaml',
    );

    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const config = yaml.load(fileContent) as any;

    this.profiles = config.profiles;
    this.defaultProfile = config.defaultProfile || 'SAFE';
  }

  getActiveProfile(): HardwareProfile {
    const envProfile = (process.env.HARDWARE_PROFILE || this.defaultProfile) as HardwareProfileName;

    const profile = this.profiles[envProfile] || this.profiles[this.defaultProfile];

    this.logger.log(`Active hardware profile: ${envProfile}`);

    return {
      name: envProfile,
      ...profile,
    };
  }

  getProfileByName(name: HardwareProfileName): HardwareProfile | null {
    const profile = this.profiles[name];

    if (!profile) {
      return null;
    }

    return {
      name,
      ...profile,
    };
  }
}
