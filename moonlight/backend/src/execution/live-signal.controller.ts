import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { LiveSignalService, LiveSignalFilters, LiveSignalListResponse } from './live-signal.service';
import { SemiAutomaticExecutor, ApprovedSignalExecution } from './semi-automatic-executor.service';
import { LiveSignal } from '../database/entities/live-signal.entity';

@Controller('live')
export class LiveSignalController {
  constructor(
    private readonly liveSignalService: LiveSignalService,
    private readonly semiAutoExecutor: SemiAutomaticExecutor,
  ) {}

  @Get('signals')
  async listSignals(
    @Query('symbol') symbol?: string,
    @Query('timeframe') timeframe?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('strategyFamily') strategyFamily?: string,
    @Query('confidenceMin') confidenceMin?: string,
    @Query('confidenceMax') confidenceMax?: string,
    @Query('range') range?: 'last_1h' | 'last_4h' | 'last_24h',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<LiveSignalListResponse> {
    const filters: LiveSignalFilters = {
      symbol,
      timeframe,
      from,
      to,
      status,
      strategyFamily,
      confidenceMin: confidenceMin ? parseFloat(confidenceMin) : undefined,
      confidenceMax: confidenceMax ? parseFloat(confidenceMax) : undefined,
      range,
    };

    return this.liveSignalService.listSignals(
      filters,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 50,
    );
  }

  @Post('signals/:id/status')
  async updateSignalStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
  ) {
    await this.liveSignalService.updateSignalStatus(id, body.status, body.notes);
    return { status: 'OK', id };
  }

  @Post('signals/:id/execute')
  async executeSignal(
    @Param('id') id: string,
    @Body() body: { account_id: string },
  ): Promise<ApprovedSignalExecution> {
    return this.semiAutoExecutor.executeApprovedSignal(id, body.account_id);
  }
}
