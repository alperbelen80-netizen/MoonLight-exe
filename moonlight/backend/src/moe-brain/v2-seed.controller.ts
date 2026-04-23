import { Controller, Post, Get } from '@nestjs/common';
import { V2SeedService } from './v2-seed.service';
import { V2_SYMBOLS, V2_TIMEFRAMES } from './v2-seed';

@Controller('moe/seed')
export class V2SeedController {
  constructor(private readonly seed: V2SeedService) {}

  @Get('preview')
  preview() {
    return {
      symbols: V2_SYMBOLS,
      timeframes: V2_TIMEFRAMES,
      expectedRows: V2_SYMBOLS.length * V2_TIMEFRAMES.length,
    };
  }

  @Post('apply')
  async apply() {
    return this.seed.seedV2Products();
  }
}
