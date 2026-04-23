import { Controller, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { IndicatorRegistryService } from './indicator-registry.service';

@Controller('indicators')
export class IndicatorRegistryController {
  constructor(private readonly reg: IndicatorRegistryService) {}

  @Get('stats')
  stats() {
    return this.reg.stats();
  }

  @Get()
  list(
    @Query('family') family?: string,
    @Query('tf') tf?: string,
    @Query('q') q?: string,
    @Query('implemented') implemented?: string,
  ) {
    return this.reg.searchIndicators({
      family,
      timeframe: tf,
      textLike: q,
      implemented: implemented === undefined ? undefined : implemented === 'true',
    });
  }

  @Get('templates')
  templates() {
    return this.reg.listTemplates();
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    // Accept either slug id or numeric n.
    const asNum = /^\d+$/.test(id) ? parseInt(id, 10) : null;
    const ind = asNum !== null ? this.reg.getIndicator(asNum) : this.reg.getIndicator(id);
    if (!ind) {
      throw new HttpException(`indicator not found: ${id}`, HttpStatus.NOT_FOUND);
    }
    return ind;
  }
}
