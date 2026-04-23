import { Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
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

  @Get('export.csv')
  exportCsv(@Res() res: Response) {
    const rows = this.harness.recent(500);
    const header = 'mode,decision,confidence,at,w_ceo,w_trade,w_test\n';
    const body = rows
      .map(
        (r) =>
          `${r.mode},${r.decision},${r.confidence},${r.at},${r.weights.ceo},${r.weights.trade},${r.weights.test}`,
      )
      .join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="moe_ab_samples.csv"');
    res.send(header + body + '\n');
  }
}
