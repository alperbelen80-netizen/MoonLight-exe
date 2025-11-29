import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import {
  BacktestRunRequestDTO,
  BacktestRunSummaryDTO,
  BacktestRunDetailDTO,
} from '../shared/dto/backtest.dto';

@Controller('backtest')
export class BacktestController {
  constructor(private readonly backtestService: BacktestService) {}

  @Post('run')
  async startRun(
    @Body() request: BacktestRunRequestDTO,
  ): Promise<BacktestRunSummaryDTO> {
    return this.backtestService.startBacktest(request);
  }

  @Get('status/:runId')
  async getStatus(
    @Param('runId') runId: string,
  ): Promise<BacktestRunSummaryDTO | null> {
    return this.backtestService.getSummary(runId);
  }

  @Get('detail/:runId')
  async getDetail(
    @Param('runId') runId: string,
  ): Promise<BacktestRunDetailDTO | null> {
    return this.backtestService.getDetail(runId);
  }
}
