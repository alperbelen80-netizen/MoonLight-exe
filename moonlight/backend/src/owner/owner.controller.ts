import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { OwnerService } from './owner.service';
import {
  OwnerDashboardSummaryDTO,
} from '../shared/dto/owner-dashboard-summary.dto';
import { ExecutionModeDTO } from '../shared/dto/execution-mode.dto';
import { ProductExecutionConfigDTO } from '../shared/dto/product-execution-config.dto';
import { OwnerAccountDTO } from '../shared/dto/owner-account.dto';
import { ExecutionMode } from '../shared/enums/execution-mode.enum';

@Controller('owner')
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  @Get('dashboard/summary')
  async getDashboardSummary(): Promise<OwnerDashboardSummaryDTO> {
    return this.ownerService.getDashboardSummary();
  }

  @Get('accounts')
  async getAccounts(): Promise<OwnerAccountDTO[]> {
    return this.ownerService.getAccounts();
  }

  @Get('execution-matrix')
  async getExecutionMatrix(): Promise<ProductExecutionConfigDTO[]> {
    return this.ownerService.getProductExecutionMatrix();
  }

  @Patch('execution-matrix/:id')
  async updateExecutionMatrix(
    @Param('id') id: string,
    @Body() patch: Partial<ProductExecutionConfigDTO>,
  ): Promise<ProductExecutionConfigDTO> {
    return this.ownerService.updateProductExecutionConfig(id, patch);
  }

  @Get('execution-mode')
  async getExecutionMode(): Promise<ExecutionModeDTO> {
    return this.ownerService.getExecutionMode();
  }

  @Post('execution-mode')
  async setExecutionMode(
    @Body() body: { mode: ExecutionMode },
  ): Promise<ExecutionModeDTO> {
    return this.ownerService.setExecutionMode(body.mode);
  }

  @Post('accounts')
  async createAccount(
    @Body() body: { alias: string; broker_id: string; type: string },
  ): Promise<OwnerAccountDTO> {
    return this.ownerService.createAccount({
      alias: body.alias,
      brokerId: body.broker_id,
      type: body.type,
    });
  }
}
