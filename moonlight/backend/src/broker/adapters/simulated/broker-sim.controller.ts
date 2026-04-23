import { Controller, Post, Get, Body } from '@nestjs/common';
import {
  BrokerSimRegistry,
  BrokerSimProfile,
  SimulatedBrokerState,
} from './simulated-broker.adapter';
import { BrokerId } from '../../health/broker-health-registry.service';

interface ConfigureRequest {
  brokerId: BrokerId;
  seed?: number;
  profile?: Partial<BrokerSimProfile>;
  reset?: boolean;
}

/**
 * V2.5-2 Broker Simulator control surface.
 *
 * Provides deterministic, operator-level control over the quad-core
 * simulated broker adapters:
 *  - GET  /api/broker/sim/state        → current snapshots for all brokers
 *  - POST /api/broker/sim/reset        → hard-reset (seed, counters, positions)
 *  - POST /api/broker/sim/configure    → reseed & profile-override a broker
 *
 * All routes stay scoped to the simulator — they never touch a real adapter.
 */
@Controller('broker/sim')
export class BrokerSimController {
  constructor(private readonly registry: BrokerSimRegistry) {}

  @Get('state')
  getState(): { brokers: SimulatedBrokerState[] } {
    return { brokers: this.registry.listSnapshots() };
  }

  @Post('reset')
  resetAll(): { reset: number; brokers: SimulatedBrokerState[] } {
    const snaps = this.registry.resetAll();
    return { reset: snaps.length, brokers: snaps };
  }

  @Post('configure')
  configure(@Body() body: ConfigureRequest):
    | { ok: true; state: SimulatedBrokerState }
    | { ok: false; error: string } {
    if (!body?.brokerId) {
      return { ok: false, error: 'brokerId required' };
    }
    const adapter = this.registry.get(body.brokerId);
    if (!adapter) {
      return { ok: false, error: `sim broker not found: ${body.brokerId}` };
    }
    const state = adapter.configure({
      seed: body.seed,
      profile: body.profile,
      reset: body.reset,
    });
    return { ok: true, state };
  }
}
