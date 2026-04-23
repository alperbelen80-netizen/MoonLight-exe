import { Injectable, Logger } from '@nestjs/common';
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import glob from 'fast-glob';
import { PresetStrategyDTO } from '../../shared/dto/preset-strategy.dto';
import { StrategyFactoryService } from '../factory/strategy-factory.service';
import { IndicatorService } from '../indicators/indicator.service';
import { createStrategyInstanceFromDescriptor } from '../factory/strategy-loader';
import { resolveConfigDir } from '../../shared/utils/resolve-config-path';

@Injectable()
export class PresetLoaderService {
  private readonly logger = new Logger(PresetLoaderService.name);
  private readonly baseDir = resolveConfigDir('config', 'strategy-presets');

  async loadAllPresets(): Promise<PresetStrategyDTO[]> {
    const pattern = path.join(this.baseDir, '**', '*.yaml');
    const files = await glob(pattern);

    const presets: PresetStrategyDTO[] = [];

    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = yaml.load(content) as any;

        presets.push(parsed as PresetStrategyDTO);
      } catch (error: any) {
        this.logger.error(
          `Failed to load preset from ${filePath}: ${error?.message || String(error)}`,
        );
      }
    }

    this.logger.log(`Loaded ${presets.length} presets from YAML files`);
    return presets;
  }

  async getPresetById(id: string): Promise<PresetStrategyDTO | undefined> {
    const all = await this.loadAllPresets();
    return all.find((p) => p.id === id);
  }

  async registerPresetsIntoFactory(
    factory: StrategyFactoryService,
    indicatorService: IndicatorService,
  ): Promise<void> {
    const presets = await this.loadAllPresets();

    for (const preset of presets) {
      const instance = createStrategyInstanceFromDescriptor(preset, indicatorService);
      factory.registerStrategy(instance);
    }

    this.logger.log(
      `Registered ${presets.length} presets into StrategyFactory`,
    );
  }
}
