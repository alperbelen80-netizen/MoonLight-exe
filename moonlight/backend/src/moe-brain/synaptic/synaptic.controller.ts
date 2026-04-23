import { Body, Controller, Get, Post } from '@nestjs/common';
import { SynapticRulesService, SynapticConfig } from './synaptic-rules.service';
import { SynapticRule } from '../shared/moe.enums';

interface ApplyDto {
  rule: SynapticRule;
  weight: number;
  x: number;
  y: number;
  actualRate?: number;
}

@Controller('moe/synaptic')
export class SynapticController {
  constructor(private readonly svc: SynapticRulesService) {}

  @Get('config')
  getConfig() {
    return this.svc.getConfig();
  }

  @Post('config')
  setConfig(@Body() patch: Partial<SynapticConfig>) {
    return this.svc.setConfig(patch || {});
  }

  @Get('rules')
  rules() {
    return Object.values(SynapticRule);
  }

  @Post('apply')
  apply(@Body() dto: ApplyDto) {
    return this.svc.apply(dto.rule, dto.weight, dto.x, dto.y, dto.actualRate);
  }
}
