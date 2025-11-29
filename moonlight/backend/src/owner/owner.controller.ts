import { Controller, Get } from '@nestjs/common';
import { OwnerService } from './owner.service';
import { OwnerDashboardSummaryDTO } from '../shared/dto/owner-dashboard.dto';

@Controller('owner')
export class OwnerController {
  constructor(private readonly ownerService: OwnerService) {}

  @Get('dashboard/summary')
  async getDashboardSummary(): Promise<OwnerDashboardSummaryDTO> {
    return this.ownerService.getDashboardSummary();
  }
}
