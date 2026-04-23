import { Controller, Get, Post, Query } from '@nestjs/common';
import { ABWeightingHarnessService } from './ab-weighting-harness.service';

@Controller('moe/ab')
export class ABWeightingController {
  constructor(private readonly harness: ABWeightingHarnessService) {}

  @Get('buckets')
  buckets() {
    return this.harness.buckets();
  }

  @Get('recent')
  recent(@Query('limit') limit?: string) {
    const n = Math.min(500, Math.max(1, parseInt(limit || '50', 10) || 50));
    return this.harness.recent(n);
  }

  @Post('clear')
  clear() {
    this.harness.clear();
    return { cleared: true };
  }
}
