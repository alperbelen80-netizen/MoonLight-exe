// MoonLight V2.0-ε — Indicator Registry Service.
//
// Loads the JSON catalog of 100 indicators + 100 multi-use templates
// and exposes lookup + search helpers. No live math is bound here;
// real math lives in strategy/indicator-library when a template is
// wired into a live strategy. Registry just makes the catalog
// discoverable to the UI and to the Strategy Factory.

import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';

export interface IndicatorEntry {
  id: string;
  n: number;
  name: string;
  family: string;
  measures: string;
  defaultParams: string;
  suitableTimeframes: string;
  longReading: string;
  shortReading: string;
  bestMatch: string;
  implemented: boolean;
}

export interface TemplateEntry {
  id: string;
  n: number;
  name: string;
  purpose: string;
  components: string;
  suitableTimeframes: string;
  longRule: string;
  shortRule: string;
  implemented: boolean;
}

@Injectable()
export class IndicatorRegistryService {
  private readonly logger = new Logger(IndicatorRegistryService.name);
  private indicators: IndicatorEntry[] = [];
  private templates: TemplateEntry[] = [];

  constructor() {
    this.load();
  }

  load(): void {
    try {
      const baseDir = this.resolveBase();
      const indPath = path.join(baseDir, 'indicators.json');
      const tplPath = path.join(baseDir, 'templates.json');
      this.indicators = JSON.parse(fs.readFileSync(indPath, 'utf8'));
      this.templates = JSON.parse(fs.readFileSync(tplPath, 'utf8'));
      this.logger.log(
        `Indicator registry loaded: ${this.indicators.length} indicators + ${this.templates.length} templates`,
      );
    } catch (err) {
      this.logger.error(`IndicatorRegistry load failed: ${(err as Error).message}`);
      this.indicators = [];
      this.templates = [];
    }
  }

  private resolveBase(): string {
    // Works both when running from src/ (ts-node/test) and from dist/,
    // and when bundled into the Electron app under resources/backend-bundle.
    const candidates = [
      path.join(__dirname, 'templates'),
      path.join(__dirname, '..', '..', 'src', 'indicators', 'templates'),
      path.join(process.cwd(), 'src', 'indicators', 'templates'),
      path.join(__dirname, '..', '..', '..', 'src', 'indicators', 'templates'),
      // Packaged Electron app
      ...((process as unknown as { resourcesPath?: string }).resourcesPath
        ? [
            path.join(
              (process as unknown as { resourcesPath: string }).resourcesPath,
              'backend-bundle',
              'src',
              'indicators',
              'templates',
            ),
          ]
        : []),
      // MOONLIGHT_CONFIG_DIR override
      ...(process.env.MOONLIGHT_CONFIG_DIR
        ? [path.join(process.env.MOONLIGHT_CONFIG_DIR, 'indicators', 'templates')]
        : []),
    ];
    for (const p of candidates) {
      if (fs.existsSync(path.join(p, 'indicators.json'))) return p;
    }
    throw new Error('indicators.json not found in known locations');
  }

  listIndicators(): IndicatorEntry[] {
    return [...this.indicators];
  }

  listTemplates(): TemplateEntry[] {
    return [...this.templates];
  }

  getIndicator(idOrNumber: string | number): IndicatorEntry | null {
    if (typeof idOrNumber === 'number') {
      return this.indicators.find((i) => i.n === idOrNumber) || null;
    }
    return this.indicators.find((i) => i.id === idOrNumber) || null;
  }

  getTemplate(idOrNumber: string | number): TemplateEntry | null {
    if (typeof idOrNumber === 'number') {
      return this.templates.find((t) => t.n === idOrNumber) || null;
    }
    return this.templates.find((t) => t.id === idOrNumber) || null;
  }

  searchIndicators(query: {
    family?: string;
    timeframe?: string;
    textLike?: string;
    implemented?: boolean;
  }): IndicatorEntry[] {
    const q = (query.textLike || '').toLowerCase();
    return this.indicators.filter((i) => {
      if (query.family && !i.family.toLowerCase().includes(query.family.toLowerCase()))
        return false;
      if (
        query.timeframe &&
        !i.suitableTimeframes.toLowerCase().includes(query.timeframe.toLowerCase())
      )
        return false;
      if (q && !`${i.name} ${i.measures}`.toLowerCase().includes(q)) return false;
      if (query.implemented !== undefined && i.implemented !== query.implemented) return false;
      return true;
    });
  }

  stats() {
    const familyCounts: Record<string, number> = {};
    for (const i of this.indicators) {
      familyCounts[i.family] = (familyCounts[i.family] || 0) + 1;
    }
    return {
      totalIndicators: this.indicators.length,
      totalTemplates: this.templates.length,
      implementedIndicators: this.indicators.filter((i) => i.implemented).length,
      implementedTemplates: this.templates.filter((t) => t.implemented).length,
      familyCounts,
    };
  }
}
