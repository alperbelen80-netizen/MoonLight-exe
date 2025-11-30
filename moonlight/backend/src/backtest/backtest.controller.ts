import { Controller, Post, Get, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { BacktestService } from './backtest.service';
import { MonteCarloService } from './monte-carlo.service';
import { WalkForwardService } from './walk-forward.service';
import {
  BacktestRunRequestDTO,
  BacktestRunSummaryDTO,
  BacktestRunDetailDTO,
  BacktestRunListResponse,
} from '../shared/dto/backtest.dto';

@Controller('backtest')
export class BacktestController {
  constructor(
    private readonly backtestService: BacktestService,
    private readonly monteCarloService: MonteCarloService,
    private readonly walkForwardService: WalkForwardService,
  ) {}

  @Post('run')
  async startRun(
    @Body() request: BacktestRunRequestDTO,
  ): Promise<BacktestRunSummaryDTO> {
    return this.backtestService.startBacktest(request);
  }

  @Get('runs')
  async listRuns(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('symbol') symbol?: string,
    @Query('timeframe') timeframe?: string,
    @Query('strategyCode') strategyCode?: string,
    @Query('environment') environment?: string,
    @Query('hardwareProfile') hardwareProfile?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('minWinRate') minWinRate?: string,
    @Query('maxWinRate') maxWinRate?: string,
    @Query('minNetPnl') minNetPnl?: string,
    @Query('maxNetPnl') maxNetPnl?: string,
    @Query('tag') tag?: string,
    @Query('isFavorite') isFavorite?: string,
  ): Promise<BacktestRunListResponse> {
    const minWR = minWinRate ? parseFloat(minWinRate) : undefined;
    const maxWR = maxWinRate ? parseFloat(maxWinRate) : undefined;

    if (minWR !== undefined && maxWR !== undefined && minWR > maxWR) {
      throw new BadRequestException('minWinRate cannot be greater than maxWinRate');
    }

    const minPnl = minNetPnl ? parseFloat(minNetPnl) : undefined;
    const maxPnl = maxNetPnl ? parseFloat(maxNetPnl) : undefined;

    if (minPnl !== undefined && maxPnl !== undefined && minPnl > maxPnl) {
      throw new BadRequestException('minNetPnl cannot be greater than maxNetPnl');
    }

    if (from && to && new Date(from) > new Date(to)) {
      throw new BadRequestException('from date cannot be after to date');
    }

    return this.backtestService.getBacktestRuns({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      symbol,
      timeframe,
      strategyCode,
      environment,
      hardwareProfile,
      from,
      to,
      minWinRate: minWR,
      maxWinRate: maxWR,
      minNetPnl: minPnl,
      maxNetPnl: maxPnl,
      tag,
      isFavorite: isFavorite === 'true' ? true : isFavorite === 'false' ? false : undefined,
    });
  }

  @Get('runs/:id')
  async getRunById(@Param('id') id: string): Promise<BacktestRunSummaryDTO | null> {
    return this.backtestService.getBacktestRunById(id);
  }

  @Get('runs/:id/monte-carlo')
  async runMonteCarlo(
    @Param('id') id: string,
    @Query('simulations') simulations?: string,
  ) {
    const sims = simulations ? parseInt(simulations, 10) : 1000;
    return this.monteCarloService.runMonteCarloSimulation(id, sims);
  }

  @Get('runs/:id/walk-forward')
  async runWalkForward(
    @Param('id') id: string,
    @Query('windowSize') windowSize?: string,
  ) {
    const window = windowSize ? parseInt(windowSize, 10) : 100;
    return this.walkForwardService.analyzeWalkForward(id, window);
  }

  @Post('runs/:id/tags')
  async updateTags(
    @Param('id') id: string,
    @Body() body: { tags: string[] },
  ) {
    if (body.tags.length > 20) {
      throw new BadRequestException('Maximum 20 tags allowed');
    }

    if (body.tags.some((t) => t.length > 50)) {
      throw new BadRequestException('Tag length cannot exceed 50 characters');
    }

    await this.backtestService.updateTags(id, body.tags);
    return { status: 'OK', id };
  }

  @Post('runs/:id/notes')
  async updateNotes(
    @Param('id') id: string,
    @Body() body: { notes: string },
  ) {
    if (body.notes && body.notes.length > 5000) {
      throw new BadRequestException('Notes cannot exceed 5000 characters');
    }

    await this.backtestService.updateNotes(id, body.notes);
    return { status: 'OK', id };
  }

  @Post('runs/:id/favorite')
  async updateFavorite(
    @Param('id') id: string,
    @Body() body: { is_favorite: boolean },
  ) {
    await this.backtestService.updateFavorite(id, body.is_favorite);
    return { status: 'OK', id };
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
