import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionRequestDTO, ExecutionStartResultDTO } from '../shared/dto/execution-request.dto';

@Controller('exec')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post('signal')
  async executeSignal(
    @Body() request: ExecutionRequestDTO,
  ): Promise<ExecutionStartResultDTO> {
    return this.executionService.startExecution(request);
  }

  @Get('pipeline/:tradeUid')
  async getPipelineStatus(@Param('tradeUid') tradeUid: string) {
    return {
      trade_uid: tradeUid,
      status: 'PLACEHOLDER',
    };
  }
}
