// MoonLight V2.4-D — Broker Health API + Quad-Core Router Adapter.

import { Controller, Get, Param } from '@nestjs/common';
import { BrokerHealthRegistryService, BrokerId } from './broker-health-registry.service';

@Controller('broker/health')
export class BrokerHealthController {
  constructor(private readonly registry: BrokerHealthRegistryService) {}

  @Get()
  list() {
    return this.registry.list();
  }

  @Get(':brokerId')
  get(@Param('brokerId') brokerId: string) {
    return this.registry.get(brokerId.toUpperCase() as BrokerId) || { error: 'unknown_broker' };
  }
}
